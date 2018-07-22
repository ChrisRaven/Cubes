// ==UserScript==
// @name         Cubes
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Shows statuses of cubes
// @author       Krzysztof Kruk
// @match        https://*.eyewire.org/*
// @exclude      https://*.eyewire.org/1.0/*
// @downloadURL  https://raw.githubusercontent.com/ChrisRaven/EyeWire-Cubes/master/cubes.user.js
// ==/UserScript==

/*jshint esversion: 6 */
/*globals $, account, tomni, Cell */

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
        return localStorage.getItem(account.account.uid + '-ews-' + key);
      },

      set: function (key, val) {
        localStorage.setItem(account.account.uid + '-ews-' + key, val);
      },

      remove: function (key) {
        localStorage.removeItem(account.account.uid + '-ews-' + key);
      }
    }
  };
  
/*
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
      let state = storedState === null ? settings.defaultState : storedState.toLowerCase() === 'true';

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
      if (val.toLowerCase() === 'true') {
        return true;
      }
      if (val.toLowerCase() === 'false') {
        return false;
      }

      return val;
    };
  }
*/


  function createPanel() {
    let leaderboard = K.qS('.ovlbContainer');

    let panel = document.createElement('div');
    panel.id = 'ews-cubes-panel';
    panel.innerHTML = `
      <span class="ews-cubes-tab active" id="ews-cubes-tab-main">main</span>
      <span class="ews-cubes-tab" id="ews-cubes-tab-sc-info">sc-info</span>
      <span class="ews-cubes-tab" id="ews-cubes-tab-low-wt">low-wt</span>
      <span class="ews-cubes-tab" id="ews-cubes-tab-low-wt-sc">low-wt-sc</span>
      <div id="ews-cubes-container">
      </div>
    `;
    leaderboard.parentNode.insertBefore(panel, leaderboard.nextElementSibling);
  }

  function tabMain() {
    K.gid('ews-cubes-tab-main').classList.add('loading');
    clickedCubes = [];
    $.when($.getJSON("/1.0/cell/" + tomni.cell + "/heatmap/scythe"))
    .always(() => K.gid('ews-cubes-tab-main').classList.remove('loading'));
  }

  function tabScInfo() {
    let cellId = tomni.cell;

    K.gid('ews-cubes-tab-sc-info').classList.add('loading');
    $.when(
      $.getJSON("/1.0/cell/" + cellId + "/tasks"),
      $.getJSON("/1.0/cell/" + cellId + "/heatmap/scythe"),
      $.getJSON("/1.0/cell/" + cellId + "/tasks/complete/player")
    )
    .done(function (tasks, scythe, completed) {
      let potential, complete, uid, completedByMe;

      tasks = tasks[0];
      complete = scythe[0].complete || [];
      completed = completed[0];

      
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

      clear();

      if (potential.length) {
        potential.forEach(id => addCube(id, Cell.ScytheVisionColors.complete1));
      }
      else {
        K.gid('ews-cubes-container').innerHTML = '<div class="msg">No cubes to SC for you</div>';
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
    clear();

    K.gid('ews-cubes-tab-low-wt').classList.add('loading');

    let processWt = function (wt, frozen, data) {
      let swt = wt.toString();
      if (data[swt] && data[swt].length) {
        let cubes = data[swt].filter(el => {return !frozen.includes(el.task_id)});

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

        for (let i = 0; i < 3; i++) {
          processWt(i, scytheData.frozen, lowWtData);
        }

        if (noCubes) {
          K.gid('ews-cubes-container').innerHTML = '<div class="msg">No low-weight cubes</div>';
        }

      }).fail((jqXHR, textStatus, errorThrown) => console.log(textStatus, errorThrown))
      .always(() => K.gid('ews-cubes-tab-low-wt').classList.remove('loading'));
  }


  function tabLowWtSc() {
    let cellId = tomni.cell;

    K.gid('ews-cubes-tab-low-wt-sc').classList.add('loading');
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

          clear();
          if (result.length) {
            result.forEach(id => addCube(id, Cell.ScytheVisionColors.base));
          }
          else {
            K.gid('ews-cubes-container').innerHTML = '<div class="msg">No low-weight cubes SC-ed by you</div>';
          }
      })
      .fail((jqXHR, textStatus, errorThrown) => console.log(textStatus, errorThrown))
      .always(() => K.gid('ews-cubes-tab-low-wt-sc').classList.remove('loading'));
  }

  function setActiveTab(target) {
    activeTab = target.id;
    $('.ews-cubes-tab').removeClass('active');
    target.classList.add('active');
  }

  function clear() {
    K.gid('ews-cubes-container').innerHTML = '';
  }

  function addCube(id, color) {
    let cube = document.createElement('div');
    cube.classList.add('ews-cubes-cube');
    cube.style.backgroundColor = color;
    if (activeTab === 'ews-cubes-tab-main' && clickedCubes.includes(id)) {
      cube.style.borderColor = 'black';
    }
    cube.dataset.id = id;
    cube.title = id;
    K.gid('ews-cubes-container').appendChild(cube);
  }

  function processCubesInMain(duplicates, flagged, frozen, reaped) {
    flagged = flagged.filter(id => !reaped.includes(id));

    if (!duplicates.length && !flagged.length && !frozen.length) {
      K.gid('ews-cubes-container').innerHTML = '<div class="msg">No flags, duplicates or scythe frozen cubes</div>';
      return;
    }

    // 3054639 - flagged and stashed example
    $.when($.getJSON("/1.0/cell/" + tomni.cell + "/tasks")).done(function (tasks) {
      let potential = tasks.tasks;
      flagged = potential.filter(el => {return flagged.includes(el.id) && el.status !== 6});
      flagged = flagged.map(el => {return el.id});

      clear();
      duplicates.forEach(id => addCube(id, Cell.ScytheVisionColors.duplicate));
      flagged.forEach(id => addCube(id, Cell.ScytheVisionColors.review));
      frozen.forEach(id => addCube(id, Cell.ScytheVisionColors.scythefrozen));
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

  // let settings;
  let activeTab = 'ews-cubes-tab-main';
  let clickedCubes = [];


  function main() {
    // settings = new Settings();
    if (LOCAL) {
      K.addCSSFile('http://127.0.0.1:8887/styles.css');
    }
    else {
      K.addCSSFile('https://chrisraven.github.io/EyeWire-Cubes/styles.css?v=2');
    }

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
            if (cellId === tomni.cell) {
              $(document).trigger('scythe-map-updated.cubes', {response: JSON.parse(this.responseText)});
            }
          }
        }, false);
        open.call(this, method, url, async, user, pass);
      };
    }) (XMLHttpRequest.prototype.open);
  `);

    createPanel();


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
          processCubesInMain(r.duplicate, r.review, r.scythe_frozen, r.reaped.concat(r.scythed));
        }
      })
      .on('cell-info-ready-triggered.cubes', function () {
        if (!tomni.gameMode) {
          K.gid('ews-cubes-tab-main').click();
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
            clickedCubes.push(id);
            this.style.borderColor = 'black';
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
