// ==UserScript==
// @name         Cubes
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Shows statuses of cubes
// @author       Krzysztof Kruk
// @match        https://*.eyewire.org/*
// @exclude      https://*.eyewire.org/1.0/*
// @downloadURL  https://raw.githubusercontent.com/ChrisRaven/EyeWire-Cubes/master/cubes.user.js
// ==/UserScript==

/*jshint esversion: 6, bitwise: false */
/*globals $, account, tomni, Cell, ColorUtils */

let LOCAL = false;
if (LOCAL) {
  console.log('%c--== TURN OFF "LOCAL" BEFORE RELEASING!!! ==--', "color: red; font-style: italic; font-weight: bold;");
}


(function() {
  'use strict';
  'esversion: 6';

  let K = {
    gid: function (id) {
      return document.getElementById(id);
    },

    qS: function (sel) {
      return document.querySelector(sel);
    },

    qSa: function (sel) {
      return document.querySelectorAll(sel);
    },


    addCSSFile: function (path) {
      $("head").append('<link href="' + path + '" rel="stylesheet" type="text/css">');
    },

    
    // Source: https://stackoverflow.com/a/6805461
    injectJS: function (text, sURL) {
      let
        tgt,
        scriptNode = document.createElement('script');

      scriptNode.type = "text/javascript";
      if (text) {
        scriptNode.textContent = text;
      }
      if (sURL) {
        scriptNode.src = sURL;
      }

      tgt = document.getElementsByTagName('head')[0] || document.body || document.documentElement;
      tgt.appendChild(scriptNode);
    },

    // localStorage
    ls: {
      get: function (key) {
        let item = localStorage.getItem(account.account.uid + '-ews-' + key);
        if (item) {
          if (item === 'true') {
            return true;
          }
          if (item === 'false') {
            return false;
          }
        }

        return item;
      },

      set: function (key, val) {
        localStorage.setItem(account.account.uid + '-ews-' + key, val);
      },

      remove: function (key) {
        localStorage.removeItem(account.account.uid + '-ews-' + key);
      }
    }
  };

  // source: https://css-tricks.com/snippets/javascript/lighten-darken-color/
  function LightenDarkenColor(col, amt) {
  
    var usePound = false;
  
    if (col[0] == "#") {
        col = col.slice(1);
        usePound = true;
    }
 
    var num = parseInt(col,16);
 
    var r = (num >> 16) + amt;
 
    if (r > 255) r = 255;
    else if  (r < 0) r = 0;
 
    var b = ((num >> 8) & 0x00FF) + amt;
 
    if (b > 255) b = 255;
    else if  (b < 0) b = 0;
 
    var g = (num & 0x0000FF) + amt;
 
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
 
    return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16);
  
}
  

function Settings() {
    let target;
    
    this.setTarget = function (selector) {
      target = selector;
    };
    
    this.getTarget = function () {
      return target;
    };
    
    this.addCategory = function (id = 'ews-cubes-settings-group', name = 'Cubes') {
      if (!K.gid(id)) {
        $('#settingsMenu').append(`
          <div id="${id}" class="settings-group ews-settings-group invisible">
            <h1>${name}</h1>
          </div>
        `);
      }
      
      this.setTarget($('#' + id));
    };

    this.addOption = function (options) {
      let settings = {
        name: '',
        id: '',
        defaultState: false,
        indented: false
      };

      $.extend(settings, options);
      let storedState = K.ls.get(settings.id);
            let state;

      if (storedState === null) {
        K.ls.set(settings.id, settings.defaultState);
        state = settings.defaultState;
      }
      else {
        state = storedState;
      }

      target.append(`
        <div class="setting" id="${settings.id}-wrapper">
          <span>${settings.name}</span>
          <div class="checkbox ${state ? 'on' : 'off'}">
            <div class="checkbox-handle"></div>
            <input type="checkbox" id="${settings.id}" style="display: none;" ${state ? ' checked' : ''}>
          </div>
        </div>
      `);
      
      if (settings.indented) {
        K.gid(settings.id).parentNode.parentNode.style.marginLeft = '30px';
      }
      
      $(`#${settings.id}-wrapper`).click(function (evt) {
        evt.stopPropagation();

        let $elem = $(this).find('input');
        let elem = $elem[0];
        let newState = !elem.checked;

        K.ls.set(settings.id, newState);
        elem.checked = newState;

        $elem.add($elem.closest('.checkbox')).removeClass(newState ? 'off' : 'on').addClass(newState ? 'on' : 'off');
        $(document).trigger('ews-setting-changed', {setting: settings.id, state: newState});
      });
      
      $(document).trigger('ews-setting-changed', {setting: settings.id, state: state});
    };
    
    this.getValue = function (optionId) {
      let val = K.ls.get(optionId);
      
      if (val === null) {
        return undefined;
      }

      return val;
    };

    this.setValue = function (optionId, newState) {
      K.ls.set(optionId, newState);
      K.qS('#hide-my-reaps-in-forts-wrapper > div').classList.toggle('on', newState);
      K.qS('#hide-my-reaps-in-forts-wrapper > div').classList.toggle('off', !newState);
      K.gid('hide-my-reaps-in-forts').checked = newState;
    };
  }



  function createPanel() {
    let leaderboard = K.qS('.ovlbContainer');

    let panel = document.createElement('div');
    panel.id = 'ews-cubes-panel';
    panel.innerHTML = `` +
      `<span class="ews-cubes-tab active" id="ews-cubes-tab-main">main</span>` +
      `<span class="ews-cubes-tab" id="ews-cubes-tab-sc-info">scInfo</span>` +
      `<span class="ews-cubes-tab" id="ews-cubes-tab-low-wt">lowWt</span>` +
      `<span class="ews-cubes-tab" id="ews-cubes-tab-low-wt-sc">lowWtSc</span>` +
      `<span class="ews-cubes-tab" id="ews-cubes-tab-debug">debug</span>` +
      `<div id="ews-cubes-container">
      </div>
    `;
    leaderboard.parentNode.insertBefore(panel, leaderboard.nextElementSibling);

    container = K.gid('ews-cubes-container');
  }

  function tabMain() {
    K.gid('ews-cubes-tab-main').classList.add('loading');
    clickedCubes = [];
    $.when($.getJSON("/1.0/cell/" + tomni.cell + "/heatmap/scythe"))
    .always(() => K.gid('ews-cubes-tab-main').classList.remove('loading'));
    K.gid('ews-cubes-container').innerHTML = '<div id="main-main-cubes"></div><div id="main-lowwtsc-cubes"></div>';
    if (showLowWtScInMain) {
      tabLowWtSc('main-lowwtsc-cubes');
    }
    else {
      emptyMainMessage();
    }
  }

  function tabScInfo() {
    let cellId = tomni.cell;

    K.gid('ews-cubes-tab-sc-info').classList.add('loading');
    $.when(
      $.getJSON('/1.0/cell/' + cellId + '/tasks'),
      $.getJSON('/1.0/cell/' + cellId + '/heatmap/scythe'),
      $.getJSON('/1.0/cell/' + cellId + '/tasks/complete/player'),
      hideMyReapsInForts && isFort ? $.getJSON('/1.0/task?dataset=1&cell=' + cellId + '&min_weight=3') : null
    )
    .done(function (tasks, scythe, completed, players) {
      let potential, complete, uid, completedByMe, myCubes;

      tasks = tasks[0];
      complete = scythe[0].complete || [];
      completed = completed[0];

      if (hideMyReapsInForts && isFort) {
        // source: https://stackoverflow.com/a/34398349
        myCubes = players[0].reduce((result, cube) => {
          if (cube.users.split(',').indexOf(account.account.username) !== -1) {
            result.push(cube.id);
          }

          return result;
        }, []);
      }

      potential = tasks.tasks.filter(x => (x.status === 0 || x.status === 11) && x.weight >= 3);
      potential = potential.map(x => x.id);
      complete = complete.filter(x => x.votes >= 2 && !account.account.admin);
      complete = complete.map(x => x.id);
      potential = potential.filter(x => complete.indexOf(x) === -1);

      uid = account.account.uid;
      if (completed && completed.scythe[uid] && completed.scythe[uid].length) {
        // otherwise the concat() function will add "undefined" at the end of the table if the admin table is empty
        if (completed.admin[uid]) {
          completedByMe = completed.scythe[uid].concat(completed.admin[uid]);
        }
        else {
          completedByMe = completed.scythe[uid];
        }
      }
      else {
        completedByMe = [];
      }
      potential = potential.filter(x => completedByMe.indexOf(x) === -1);

      if (hideMyReapsInForts && isFort) {
        potential = potential.filter(x => myCubes.indexOf(x) === -1);
      }

      clear();

      if (potential.length) {
        potential.forEach(id => addCube(id, Cell.ScytheVisionColors.complete1));
      }
      else {
        container.innerHTML = '<div class="msg">No cubes to SC for you</div>';
      }

      K.gid('ews-cubes-tab-sc-info').title = 'done: ' + completedByMe.length + ', available: ' + potential.length;
    })
    .always(() => K.gid('ews-cubes-tab-sc-info').classList.remove('loading'));
  }

  let intersection = function (a1, a2) {
    return a1.filter(n => a2.includes(n));
  };

  function lowWtColor(wt) {
    switch (wt) {
      case 0: return '#FF554D';
      case 1: return '#46DBE8';
      case 2: return '#9659FF';
      case 3: return '#93FF59';
    }
  }

  
  function tabLowWt() {
    let noCubes = true;

    K.gid('ews-cubes-tab-low-wt').classList.add('loading');

    let processWt = function (wt, frozen, data) {
      let swt = wt.toString();
      if (data[swt] && data[swt].length) {
        let cubes = data[swt].filter(el => !frozen.includes(el.task_id));

        if (cubes.length) {
          noCubes = false;
        }

        for (let i = cubes.length - 1; i >= 0; i--) {
          addCube(cubes[i].task_id, lowWtColor(wt));
        }
      }
    };

    var cellId = tomni.cell;

    $.when($.getJSON("/1.0/cell/" + cellId + "/heatmap/scythe"),
           $.getJSON("/1.0/cell/" + cellId + "/heatmap/low-weight?weight=3"))
      .done(function (scytheData, lowWtData) {
        scytheData = scytheData[0];
        lowWtData = lowWtData[0];

        clear();

        for (let i = 0; i < 3; i++) {
          processWt(i, scytheData.frozen, lowWtData);
        }

        if (noCubes) {
          container.innerHTML = '<div class="msg">No low-weight cubes</div>';
        }

      }).fail((jqXHR, textStatus, errorThrown) => console.log(textStatus, errorThrown))
      .always(() => K.gid('ews-cubes-tab-low-wt').classList.remove('loading'));
  }


  function tabLowWtSc(target) {
    let cellId = tomni.cell;

    if (!target) {
      K.gid('ews-cubes-tab-low-wt-sc').classList.add('loading');
    }

    $.when($.getJSON("/1.0/cell/" + cellId + "/heatmap/low-weight?weight=3"),
          $.getJSON("/1.0/cell/" + cellId + "/tasks/complete/player"),
          $.getJSON("/1.0/cell/" + cellId + "/heatmap/scythe"))
      .done(function (lowWt, completeData, heatmap) {
          lowWt = lowWt[0];
          completeData = completeData[0];
          heatmap = heatmap[0];

          let adminFrozen = heatmap.frozen;

          let myTasks = completeData.scythe[account.account.uid.toString()] || [];
          myTasks = myTasks.concat(completeData.admin[account.account.uid.toString()] || []);

          let ids = [];
          for (let i = 0; i < 3; i++) {
              let wts = lowWt[i];
              if (wts) {
                for (let j = 0; j < wts.length; j++) {
                    if (!adminFrozen.includes(wts[j].task_id)) {
                      ids.push(wts[j].task_id);
                    }
                }
              }
          }

          let result = intersection(myTasks, ids);

          if (target) {
            clear('main-lowwtsc-cubes');
          }
          else {
            clear();
          }

          if (result.length) {
            result.forEach(id => addCube(id, Cell.ScytheVisionColors.base, target ? 'main-lowwtsc-cubes' : ''));
          }
          else {
            if (target) {
              emptyMainMessage();
            }
            else {
              container.innerHTML = '<div class="msg">No low-weight cubes SC-ed by you</div>';
            }
          }

      })
      .fail((jqXHR, textStatus, errorThrown) => console.log(textStatus, errorThrown))
      .always(() => { if (!target) {K.gid('ews-cubes-tab-low-wt-sc').classList.remove('loading');}});
  }

  function tabDebug() {
    debug = true;
  }

  function setActiveTab(target) {
    activeTab = target.id;
    $('.ews-cubes-tab').removeClass('active');
    target.classList.add('active');
    debug = false;
  }

  function clear(subcontainer) {
    if (subcontainer) {
      K.gid(subcontainer).innerHTML = '';
    }
    else {
      container.innerHTML = '';
    }
  }

  function addCube(id, color, subcontainer) {
    let cube = document.createElement('div');
    cube.classList.add('ews-cubes-cube');
    cube.style.backgroundColor = color;
    if (activeTab === 'ews-cubes-tab-main' && clickedCubes.includes(id)) {
      cube.style.backgroundColor = LightenDarkenColor(ColorUtils.rgbToHex(ColorUtils.toRGB(cube.style.backgroundColor)), -50);
    }
    cube.dataset.id = id;
    cube.title = id;
    if (subcontainer) {
      K.gid(subcontainer).appendChild(cube);
    }
    else {
      container.appendChild(cube);
    }
  }

  function emptyMainMessage() {
    if (!K.qS('.ews-cubes-cube')) {
      K.gid('main-main-cubes').innerHTML = '<div class="msg">No flags, duplicates or ' + (showAdminFrozenCubes ? '' : 'scythe ') + 'frozen cubes</div>';
    }
  }

  function processCubesInMain(duplicates, flagged, scytheFrozen, reaped, frozen) {
    flagged = flagged.filter(id => !reaped.includes(id));

    if (!duplicates.length && !flagged.length && !scytheFrozen.length && !(showAdminFrozenCubes && frozen.length)) {
      clear('main-main-cubes');
      emptyMainMessage();
      return;
    }

    // 3054639 - flagged and stashed example
    $.when($.getJSON("/1.0/cell/" + tomni.cell + "/tasks")).done(function (tasks) {
      let potential = tasks.tasks;
      flagged = potential.filter(el => flagged.includes(el.id) && el.status !== 6);
      flagged = flagged.map(el => el.id);

      clear('main-main-cubes');
      duplicates.forEach(id => addCube(id, Cell.ScytheVisionColors.duplicate, 'main-main-cubes'));
      flagged.forEach(id => addCube(id, Cell.ScytheVisionColors.review, 'main-main-cubes'));
      scytheFrozen.forEach(id => addCube(id, Cell.ScytheVisionColors.scythefrozen, 'main-main-cubes'));
      if (showAdminFrozenCubes) {
        frozen.forEach(id => addCube(id, Cell.ScytheVisionColors.frozen, 'main-main-cubes'));
      }
      emptyMainMessage();
    });
  }

  
  // source: https://stackoverflow.com/a/30810322
  function copyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
  
    //
    // *** This styling is an extra step which is likely not required. ***
    //
    // Why is it here? To ensure:
    // 1. the element is able to have focus and selection.
    // 2. if element was to flash render it has minimal visual impact.
    // 3. less flakyness with selection and copying which **might** occur if
    //    the textarea element is not visible.
    //
    // The likelihood is the element won't even render, not even a flash,
    // so some of these are just precautions. However in IE the element
    // is visible whilst the popup box asking the user for permission for
    // the web page to copy to the clipboard.
    //
  
    // Place in top-left corner of screen regardless of scroll position.
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;
  
    // Ensure it has a small width and height. Setting to 1px / 1em
    // doesn't work as this gives a negative w/h on some browsers.
    textArea.style.width = '2em';
    textArea.style.height = '2em';
  
    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = 0;
  
    // Clean up any borders.
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
  
    // Avoid flash of white box if rendered for any reason.
    textArea.style.background = 'transparent';
  
  
    textArea.value = text;
  
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    document.execCommand('copy');

    document.body.removeChild(textArea);
  }

  let activeTab = 'ews-cubes-tab-main';
  let clickedCubes = [];
  let debug = false;
  let container;
  let compacted;
  let compactedCSS;
  let settings;
  let showAdminFrozenCubes;
  let showLowWtScInMain;
  let hideMyReapsInForts;
  let isFort;

  
  function compact(compacted) {
    if (!compactedCSS) {
      compactedCSS = document.createElement('style');
      compactedCSS.type = 'text/css';
      document.head.appendChild(compactedCSS);
    }

    if (compacted) {
      K.gid('ews-cubes-panel').style.height = '52px';
      K.gid('ews-cubes-container').style.height = '16px';
      K.qS('.ovlbContainer').style.height = 'calc(100% - 108px)';
      compactedCSS.innerHTML = '#ews-cubes-container .msg { padding-top: 0; margin-top: -2px; }';
    }
    else {
      K.gid('ews-cubes-panel').style.height = '150px';
      K.gid('ews-cubes-container').style.height = '128px';
      K.qS('.ovlbContainer').style.height = 'calc(100% - 206px)';
      compactedCSS.innerHTML = '#ews-cubes-container .msg { padding-top: 20px; margin-top: 0; }';
    }
  }


  function main() {
    if (LOCAL) {
      K.addCSSFile('http://127.0.0.1:8887/styles.css');
    }
    else {
      K.addCSSFile('https://chrisraven.github.io/EyeWire-Cubes/styles.css?v=4');
    }

    compacted = K.ls.get('cubes-compacted');
    showLowWtScInMain = K.ls.get('show-lowwtsc-in-main-tab');
    showAdminFrozenCubes = K.ls.get('show-admin-frozen-cubes');

    K.injectJS(`
    $(window)
      .on('cell-info-ready', function (e, data) {
        $(document).trigger('cell-info-ready-triggered.cubes', data);
      })
      .on('cube-enter', function (e, data) {
        $(document).trigger('cube-enter-triggered.cubes', data);
      })
      .on('cube-leave', function (e, data) {
        $(document).trigger('cube-leave-triggered.cubes', data);
      });
    `);

    K.injectJS(`
    (function (open) {
      XMLHttpRequest.prototype.open = function (method, url, async, user, pass) {
        this.addEventListener("readystatechange", function (evt) {
          if (this.readyState == 4 && this.status == 200 && url.indexOf('/heatmap/scythe') !== -1) {
            let cellId = parseInt(url.split('cell/')[1].split('/heatmap')[0], 10);
            if (cellId === parseInt(tomni.cell, 10)) {
              $(document).trigger('scythe-map-updated.cubes', {response: JSON.parse(this.responseText)});
            }
          }
        }, false);
        open.call(this, method, url, async, user, pass);
      };
    }) (XMLHttpRequest.prototype.open);
  `);

    createPanel();
    compact(compacted);

    
    $(document).on('ews-setting-changed', function (evt, data) {
      switch (data.setting) {
        case 'show-lowwtsc-in-main-tab':
          showLowWtScInMain = data.state;
          changeVisibilityOfTabLowWtSc(data.state);
          break;
        case 'show-admin-frozen-cubes':
          showAdminFrozenCubes = data.state;
          break;
        case 'hide-my-reaps-in-forts':
          hideMyReapsInForts = data.state;
          K.gid('ews-cubes-tab-sc-info').style.color = hideMyReapsInForts && isFort ? '#00c4ff' : '#e4e1e1';
      }
    });

    settings = new Settings();
    settings.addCategory();
    settings.addOption({
      name: 'Show admin frozen cubes',
      id: 'show-admin-frozen-cubes',
      defaultState: false
    });
    settings.addOption({
      name: 'Show lowWtSc in Main tab',
      id: 'show-lowwtsc-in-main-tab',
      defaultState: false
    });
    settings.addOption({
      name: 'Hide my reaps in forts',
      id: 'hide-my-reaps-in-forts',
      defaultState: false
    });


    function changeVisibilityOfTabLowWtSc(state) {
      K.gid('ews-cubes-tab-low-wt-sc').classList.toggle('ews-cubes-hidden-tab', state);

      K.gid('ews-cubes-tab-main').classList.toggle('ews-cubes-wide-tab', state);
      K.gid('ews-cubes-tab-sc-info').classList.toggle('ews-cubes-wide-tab', state);
      K.gid('ews-cubes-tab-low-wt').classList.toggle('ews-cubes-wide-tab', state);
      K.gid('ews-cubes-tab-debug').classList.toggle('ews-cubes-wide-tab', state);
    }


    let lowWtCounter = 15;

    setInterval(function () {
      if (showLowWtScInMain && activeTab === 'ews-cubes-tab-main') {
        if (!(lowWtCounter--)) {
          lowWtCounter = 15;
          tabLowWtSc('main-lowwtsc-cubes');
        }
        else {
          K.gid('ews-cubes-tab-main').innerHTML = 'main <span class="ews-cubes-low-wt-sc-counter">' + lowWtCounter + '</span>';
        }
      }
      else {
        K.gid('ews-cubes-tab-main').innerHTML = 'main';
      }
      
    }, 1000);


    K.gid('ews-cubes-tab-main').addEventListener('click', function () {
      setActiveTab(this);
      tabMain();
    });

    K.gid('ews-cubes-tab-sc-info').addEventListener('click', function () {
      setActiveTab(this);
      tabScInfo();
    });

    K.gid('ews-cubes-tab-low-wt').addEventListener('click', function () {
      setActiveTab(this);
      tabLowWt();
    });

    K.gid('ews-cubes-tab-low-wt-sc').addEventListener('click', function () {
      setActiveTab(this);
      tabLowWtSc();
    });

    K.gid('ews-cubes-tab-debug').addEventListener('click', function () {
      setActiveTab(this);
      tabDebug();
    });


    $('#ews-cubes-tab-main, #ews-cubes-tab-sc-info, #ews-cubes-tab-low-wt, #ews-cubes-tab-low-wt-sc, #ews-cubes-tab-debug').on('dblclick', function () {
      compacted = !compacted;
      compact(compacted);
      K.ls.set('cubes-compacted', compacted);
    });


    $(document)
      .on('cube-enter-triggered.cubes', function () {
        K.gid('ews-cubes-panel').classList.add('hidden');
      })
      .on('cube-leave-triggered.cubes', function () {
        K.gid('ews-cubes-panel').classList.remove('hidden');
      })
      .on('scythe-map-updated.cubes', function (evt, data) {
        if (activeTab === 'ews-cubes-tab-main') {
          let r = data.response;
          processCubesInMain(r.duplicate, r.review, r.scythe_frozen, r.reaped.concat(r.scythed), r.frozen);
        }
      })
      .on('cell-info-ready-triggered.cubes', function () {
        if (!tomni.gameMode) {
          K.gid('ews-cubes-tab-main').click();
        }
        isFort = !!tomni.getCurrentCell().info.tags.ScytheFort;
        K.gid('ews-cubes-tab-sc-info').style.color = hideMyReapsInForts && isFort ? '#00c4ff' : '#e4e1e1';
      })
      .on('mousemove', function () {
        if (!debug) {
          return;
        }
        
        let html = '';

        var c = tomni.center.rotation;
        c = c.clone().multiplyScalar(100).round().multiplyScalar(1 / 100).floor();
        c = [c.x, c.y, c.z];

        html += '<table id="ews-debug-table">';
        html += '<tr><td>Cell: </td><td>' + tomni.cell + '</td></tr>';
        html += '<tr><td>Center: </td><td>' + '&lt;' + c.join(", ") + '&gt;</td></tr>';
        html += '<tr><td>Cube ID: </td><td>' + (tomni.task ? tomni.task.id : 'null') + '</td></tr>';
        html += '<tr><td>Last seg: </td><td>' + (tomni.lastClicked || 'null') + '</td></tr>';
        html += '</table>';

        container.innerHTML = html;
      })
      .on('click', '#dismiss-leaderboard', function () {
        if (compacted) {
          compact(!compacted);
        }
      })
      .on('click', '#recall-leaderboard', function () {
        if (compacted) {
          compact(compacted);
        }
      })
      .on('contextmenu', '#ews-cubes-tab-sc-info', function (evt) {
        evt.preventDefault();
        hideMyReapsInForts = !hideMyReapsInForts;
        settings.setValue('hide-my-reaps-in-forts', hideMyReapsInForts);
        this.style.color = hideMyReapsInForts && isFort ? '#00c4ff' : '#e4e1e1';
        this.click();
      });

      function markOpenedPanel(id) {
        K.gid('notificationHistoryButton').classList.remove('opened');
        K.gid('menu').classList.remove('opened');
        K.gid('settingsButton').classList.remove('opened');
        K.gid('helpButton').classList.remove('opened');
        if (id) {
          K.gid(id).classList.add('opened');
        }
      }

      function isAnyPanelOpened() {
        return K.gid('notificationHistoryButton').classList.contains('opened') ||
          K.gid('menu').classList.contains('opened') ||
          K.gid('settingsButton').classList.contains('opened') ||
          K.gid('helpButton').classList.contains('opened');
      }

      $('#settingsButton, #notificationHistoryButton, #menu, #helpButton').click(function () {
        let id;
        if (K.gid(this.id).classList.contains('opened')) {
          id = null;
        }
        else {
          id = this.id;
        }
        markOpenedPanel(id);

        if (isAnyPanelOpened()) {
          $('#ews-cubes-panel').hide();
        }
        else {
          $('#ews-cubes-panel').show();
        }
      });

    $('#ews-cubes-container')
      .on('click', '.ews-cubes-cube', function () {
        let id = parseInt(this.dataset.id, 10);

        if (event.ctrlKey) {
          copyTextToClipboard(id);
          return;
        }

        tomni.jumpToTaskID(id);
        switch (activeTab) {
          case 'ews-cubes-tab-main':
            if (this.parentNode.id === 'main-main-cubes') {
              clickedCubes.push(id);
              this.style.backgroundColor = LightenDarkenColor(ColorUtils.rgbToHex(ColorUtils.toRGB(this.style.backgroundColor)), -50);
            }
            else {
              this.style.backgroundColor = Cell.ScytheVisionColors.complete3;
            }
          break;
          case 'ews-cubes-tab-sc-info':
            this.style.backgroundColor = Cell.ScytheVisionColors.complete2;
            break;
          case 'ews-cubes-tab-low-wt':
            this.style.backgroundColor = lowWtColor(3);
            break;
          case 'ews-cubes-tab-low-wt-sc':
            this.style.backgroundColor = Cell.ScytheVisionColors.complete3;
            break;
        }
      });

      document.addEventListener('click', function () {
        if (isAnyPanelOpened()) {
          markOpenedPanel(null);
          $('#ews-cubes-panel').show();
        }
      });


  }

  let intv = setInterval(function () {
    if (typeof account === 'undefined' || !account.account.uid) {
      return;
    }
    clearInterval(intv);

    if (account.can('scout', 'scythe', 'mystic', 'admin')) {
      main();
    }
  }, 100);

})();
