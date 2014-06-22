﻿// Main Program

var pttchrome = {};

pttchrome.App = function(onInitializedCallback, from) {

  this.CmdHandler = document.getElementById('cmdHandler');
  this.CmdHandler.setAttribute('useMouseBrowsing', '1');
  this.CmdHandler.setAttribute('doDOMMouseScroll','0');
  //this.CmdHandler.setAttribute('useMouseUpDown', '0');
  //this.CmdHandler.setAttribute('useMouseSwitchPage', '0');
  //this.CmdHandler.setAttribute("useMouseReadThread", '0');
  this.CmdHandler.setAttribute('useTextDragAndDrop', '0');
  this.CmdHandler.setAttribute('webContextMenu', '1');
  this.CmdHandler.setAttribute('SavePageMenu', '1');
  this.CmdHandler.setAttribute('EmbeddedPlayerMenu', '1');
  this.CmdHandler.setAttribute('PreviewPictureMenu', '0');
  this.CmdHandler.setAttribute('PushThreadMenu', '0');
  this.CmdHandler.setAttribute('OpenAllLinkMenu', '0');
  this.CmdHandler.setAttribute("MouseBrowseMenu", '0');
  this.CmdHandler.setAttribute('FileIoMenu', '0');
  this.CmdHandler.setAttribute('ScreenKeyboardMenu', '1');
  this.CmdHandler.setAttribute('ScreenKeyboardOpened', '0');
  this.CmdHandler.setAttribute('DragingWindow', '0');
  this.CmdHandler.setAttribute('MaxZIndex', 11);
  this.CmdHandler.setAttribute('allowDrag','0');
  this.CmdHandler.setAttribute('haveLink','0');
  //this.CmdHandler.setAttribute('onLink','0');
  //this.CmdHandler.setAttribute('onPicLink','0');
  this.CmdHandler.setAttribute('draging','0');
  this.CmdHandler.setAttribute('textSelected','0');
  this.CmdHandler.setAttribute('dragType','');
  this.CmdHandler.setAttribute('LastPicAddr', '0');
  this.CmdHandler.setAttribute('isMouseRightBtnDrag','0');

  this.CmdHandler.setAttribute('hideBookMarkLink','1');
  this.CmdHandler.setAttribute('hideSendLink','1');
  this.CmdHandler.setAttribute('hideBookMarkPage','1');
  this.CmdHandler.setAttribute('hideSendPage','1');
  this.CmdHandler.setAttribute('hideViewInfo','1');
  this.CmdHandler.setAttribute('SkipMouseClick','0');
  this.pref = null;

  this.telnetCore = new TelnetCore(this);
  this.view = new TermView(24);
  this.buf = new TermBuf(80, 24);
  this.buf.setView(this.view);
  //this.buf.severNotifyStr=this.getLM('messageNotify');
  //this.buf.PTTZSTR1=this.getLM('PTTZArea1');
  //this.buf.PTTZSTR2=this.getLM('PTTZArea2');
  this.view.setBuf(this.buf);
  this.view.setConn(this.telnetCore);
  this.view.setCore(this);
  this.parser = new lib.AnsiParser(this.buf);

  //new pref - start
  this.antiIdleStr = '^[[A^[[B';
  this.antiIdleTime = 0;
  this.idleTime = 0;
  //new pref - end
  this.connectState = 0;

  this.inputArea = document.getElementById('t');
  this.BBSWin = document.getElementById('BBSWindow');

  // horizontally center bbs window
  this.BBSWin.setAttribute("align", "center");
  this.view.mainDisplay.style.transformOrigin = 'center';

  this.mouseLeftButtonDown = false;
  this.mouseRightButtonDown = false;

  this.inputAreaFocusTimer = null;
  this.alertBeforeUnload = false;
  this.modalShown = false;

  var self = this;
  this.CmdHandler.addEventListener("OverlayCommand", function(e) {
    self.overlayCommandListener(e);
  }, false);

  window.addEventListener('click', function(e) {
    self.mouse_click(e);
  }, false);

  window.addEventListener('mousedown', function(e) {
    self.mouse_down(e);
  }, false);

  window.addEventListener('mouseup', function(e) {
    self.mouse_up(e);
  }, false);

  document.addEventListener('mousemove', function(e) {
    self.mouse_move(e);
  }, false);

  document.addEventListener('mouseover', function(e) {
    self.mouse_over(e);
  }, false);

  window.addEventListener('mousewheel', function(e) {
    self.mouse_scroll(e);
  }, true);

  window.addEventListener('contextmenu', function(e) {
    self.context_menu(e);
  }, false);

  window.onresize = function() {
    self.onWindowResize();
  };

  this.isFromApp = (from === 'app');
  if (this.isFromApp) {
    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (msg.action === 'newwindow' && self.appConn && self.appConn.isConnected) {
        self.appConn.appPort.postMessage({ action: 'newWindow', data: msg.data });
      }
    });
  }

  this.dblclickTimer=null;
  this.mbTimer=null;
  this.timerEverySec=null;
  this.onWindowResize();
  this.setupConnectionAlert();
  this.setupOtherSiteInput();
  this.setupSideMenus();
  this.setupContextMenus();

  this.pref = new PttChromePref(this, onInitializedCallback);
  this.appConn = null;
  // load the settings after the app connection is made
  this.setupAppConnection(function() {
    // call getStorage to trigger load setting
    self.pref.getStorage();
  });

};

pttchrome.App.prototype.setupAppConnection = function(callback) {
  var self = this;
  this.appConn = new lib.AppConnection({
    host: self.telnetCore.host,
    port: self.telnetCore.port,
    onConnect: self.onConnect.bind(self),
    onDisconnect: self.onClose.bind(self),
    onReceive: self.telnetCore.onDataAvailable.bind(self.telnetCore),
    onSent: null,
    onPasteDone: self.onPasteDone.bind(self),
    onStorageDone: self.pref.onStorageDone.bind(self.pref)
  });
  this.appConn.connect(callback);
}

pttchrome.App.prototype.connect = function(url) {
  var self = this;
  var port = 23;
  var splits = url.split(/:/g);
  document.title = url;
  if (splits.length == 2) {
    url = splits[0];
    port = parseInt(splits[1]);
  }
  if (!this.appConn.isConnected) {
    this.setupAppConnection(function() {
      dumpLog(DUMP_TYPE_LOG, "connect to " + url);
      self.telnetCore.connect(url, port);
    });
  } else {
    dumpLog(DUMP_TYPE_LOG, "connect to " + url);
    this.telnetCore.connect(url, port);
  }
};

pttchrome.App.prototype.onConnect = function() {
  dumpLog(DUMP_TYPE_LOG, "pttchrome onConnect");
  this.connectState = 1;
  this.updateTabIcon('connect');
  this.idleTime = 0;
  var self = this;
  this.timerEverySec = setTimer(true, function() {
    self.antiIdle();
    self.view.onBlink();
  }, 1000);
  this.view.resetCursorBlink();
};

pttchrome.App.prototype.onData = function(data) {
//dumpLog(DUMP_TYPE_LOG, "pttchrome onData");
  this.parser.feed(data);
};

pttchrome.App.prototype.onClose = function() {
  dumpLog(DUMP_TYPE_LOG, "pttchrome onClose");
  this.timerEverySec.cancel();
  this.view.cursorBlinkTimer.cancel();
  this.telnetCore.isConnected = false;

  this.cancelMbTimer();
  this.unregExitAlert();

  this.connectState = 2;
  this.idleTime = 0;

  $('#connectionAlert').show();
  this.updateTabIcon('disconnect');
};

pttchrome.App.prototype.sendData = function(str) {
  if (this.connectState == 1)
    this.telnetCore.convSend(str);
};

pttchrome.App.prototype.sendCmdData = function(str) {
  if (this.connectState == 1)
    this.telnetCore.send(str);
};

pttchrome.App.prototype.cancelMbTimer = function() {
  if (this.mbTimer) {
    this.mbTimer.cancel();
    this.mbTimer = null;
  }
};

pttchrome.App.prototype.setMbTimer = function() {
  this.cancelMbTimer();
  var _this = this;
  this.mbTimer = setTimer(false, function() {
    _this.mbTimer.cancel();
    _this.mbTimer = null;
    _this.CmdHandler.setAttribute('SkipMouseClick', '0');
  }, 100);
};

pttchrome.App.prototype.cancelDblclickTimer = function() {
  if (this.dblclickTimer) {
    this.dblclickTimer.cancel();
    this.dblclickTimer = null;
  }
};

pttchrome.App.prototype.setDblclickTimer = function() {
  this.cancelDblclickTimer();
  var _this = this;
  this.dblclickTimer = setTimer(false, function() {
    _this.dblclickTimer.cancel();
    _this.dblclickTimer = null;
  }, 350);
};

pttchrome.App.prototype.setInputAreaFocus = function() {
  //this.DocInputArea.disabled="";
  this.inputArea.focus();
};

pttchrome.App.prototype.setupConnectionAlert = function() {
  $('#connectionAlertReconnect').empty();
  $('#connectionAlertExitAll').empty();
  $('#connectionAlertHeader').text(i18n('alert_connectionHeader'));
  $('#connectionAlertText').text(i18n('alert_connectionText'));
  $('#connectionAlertReconnect').text(i18n('alert_connectionReconnect'));
  $('#connectionAlertExitAll').text(i18n('alert_connectionExitAll'));

  var self = this;
  $('#connectionAlertReconnect').click(function(e) {
    self.connect(document.title);
    $('#connectionAlert').hide();
  });
  $('#connectionAlertExitAll').click(function(e) {
    window.open('','_self');
    window.close();

    if (self.isFromApp) {
      var port = self.appConn.appPort;
      if (!port)
        return;
      if (self.appConn.isConnected) {
        port.postMessage({ action: 'closeAppWindow' });
      }
    }
  });
};

pttchrome.App.prototype.setupOtherSiteInput = function() {
  var self = this;
  $('#siteModal input').attr('placeholder', i18n('input_sitePlaceholder'));
  $('#siteModal input').keyup(function(e) {
    if (e.keyCode == 13) {
      var url = $(this).val();
      if (self.appConn && self.appConn.isConnected) {
        self.appConn.disconnect();
        self.onClose();
      }
      self.connect(url);
      $('#siteModal').modal('hide');
    }
  });
  $('#siteModal').on('shown.bs.modal', function(e) {
    $('#connectionAlert').hide();
    self.modalShown = true;
    $('#siteModal input').val('');
    $('#siteModal input').focus();
  });
  $('#siteModal').on('hidden.bs.modal', function(e) {
    $('#connectionAlert').hide();
    self.modalShown = false;
  });

};

pttchrome.App.prototype.setupSideMenus = function() {
  // i18n
  $('#menu_goToOtherSite span').text(i18n('menu_goToOtherSite'));
  $('#menu_paste span').text(i18n('menu_paste'));
  $('#menu_selectAll span').text(i18n('menu_selectAll'));
  $('#menu_mouseBrowsing span').text(i18n('menu_mouseBrowsing'));
  $('#menu_settings span').text(i18n('menu_settings'));

  // tie the methods up to the buttons
  var self = this;
  $('#menu_goToOtherSite').click(function(e) {
    self.doGoToOtherSite();
    e.stopPropagation();
  });
  $('#menu_paste').click(function(e) {
    self.doPaste();
    e.stopPropagation();
  });
  $('#menu_selectAll').click(function(e) {
    self.doSelectAll();
    e.stopPropagation();
  });
  $('#menu_mouseBrowsing').click(function(e) {
    self.switchMouseBrowsing();
    e.stopPropagation();
  });
  $('#menu_settings').click(function(e) {
    self.doSettings();
    e.stopPropagation();
  });
  $('#sideMenus').on('contextmenu', function(e) {
    e.stopPropagation();
    e.preventDefault();
  });
};

pttchrome.App.prototype.doCopy = function(str) {
  var port = this.appConn.appPort;
  if (!port)
    return;
  
  // Doing copy by having the launch.js read message
  // and then copy onto clipboard
  if (this.appConn.isConnected) {
    port.postMessage({ action: 'copy', data: str });
  }
};

pttchrome.App.prototype.doPaste = function() {
  var port = this.appConn.appPort;
  if (!port)
    return;
  
  // Doing paste by having the launch.js read the clipboard data
  // and then send the content on the onPasteDone
  if (this.appConn.isConnected) {
    port.postMessage({ action: 'paste' });
  }
};

pttchrome.App.prototype.onPasteDone = function(content) {
  //this.telnetCore.convSend(content);
  this.view.onTextInput(content, true);
};

pttchrome.App.prototype.doSelectAll = function() {
  window.getSelection().selectAllChildren(this.view.mainDisplay);
};

pttchrome.App.prototype.doSearchGoogle = function(searchTerm) {
  window.open('http://google.com/search?q='+searchTerm);
};

pttchrome.App.prototype.doGoToOtherSite = function() {
  $('#siteModal').modal('show');
};

pttchrome.App.prototype.doSettings = function() {
  $('#prefModal').modal('show');
};

pttchrome.App.prototype.onWindowResize = function() {
  this.view.fontResize();
  if (this.view.fontFitWindowWidth || this.view.firstGrid.offsetLeft <= 100) {
    $('#sideMenus').addClass('menuHidden');
  } else {
    $('#sideMenus').removeClass('menuHidden');
  }
};

pttchrome.App.prototype.switchMouseBrowsing = function() {
  if (this.CmdHandler.getAttribute('useMouseBrowsing')=='1') {
    this.CmdHandler.setAttribute('useMouseBrowsing', '0');
    this.buf.useMouseBrowsing=false;
  } else {
    this.CmdHandler.setAttribute('useMouseBrowsing', '1');
    this.buf.useMouseBrowsing=true;
  }

  if (!this.buf.useMouseBrowsing) {
    this.buf.BBSWin.style.cursor = 'auto';
    this.buf.clearHighlight();
    this.buf.mouseCursor=0;
    this.buf.nowHighlight=-1;
    this.buf.tempMouseCol=0;
    this.buf.tempMouseRow=0;
  } else {
    this.buf.SetPageState();
    this.buf.resetMousePos();
    this.view.redraw(true);
    this.view.updateCursorPos();
  }
};

pttchrome.App.prototype.antiIdle = function() {
  if (this.antiIdleTime && this.idleTime > this.antiIdleTime) {
    if (this.antiIdleStr!='' && this.connectState==1)
      this.telnetCore.send(this.antiIdleStr);
  } else {
    if (this.connectState==1)
      this.idleTime+=1000;
  }
};

pttchrome.App.prototype.updateTabIcon = function(aStatus) {
  var icon = 'icon/logo.png';
  switch (aStatus) {
    case 'connect':
      icon =  'icon/connect.png';
      this.setInputAreaFocus();
      break;
    case 'disconnect':
  dumpLog(DUMP_TYPE_LOG, "icon/disconnect.png");
      icon =  'icon/disconnect.png';
      break;
    case 'newmessage':  // Not used yet
      icon =  'icon/connect.png';
      break;
    case 'connecting':  // Not used yet
      icon =  'icon/connecting.gif';
    default:
  }

  var link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "icon");
    link.setAttribute("href", icon);
    document.head.appendChild(link);
  } else {
    link.setAttribute("href", icon);
  }
};

// use this method to get better window size in case of page zoom != 100%
pttchrome.App.prototype.getWindowInnerBounds = function() {
  var width = document.documentElement.clientWidth;
  var height = document.documentElement.clientHeight;
  var bounds = {
    width: width,
    height: height
  };
  return bounds;
};

pttchrome.App.prototype.clientToPos = function(cX, cY) {
  var x;
  var w = this.getWindowInnerBounds().width;
  if (this.view.horizontalAlignCenter && this.view.scaleX != 1)
    x = cX - ((w - (this.view.chw * this.buf.cols) * this.view.scaleX) / 2);
  else
    x = cX - parseFloat(this.view.firstGrid.offsetLeft);
  var y = cY - parseFloat(this.view.firstGrid.offsetTop);
  var col = Math.floor(x / (this.view.chw * this.view.scaleX));
  var row = Math.floor(y / this.view.chh);

  if (row < 0)
    row = 0;
  else if (row >= this.buf.rows-1)
    row = this.buf.rows-1;

  if (col < 0)
    col = 0;
  else if (col >= this.buf.cols-1)
    col = this.buf.cols-1;

  return {col: col, row: row};
};

pttchrome.App.prototype.onMouse_click = function (cX, cY) {
  if (!this.telnetCore.isConnected)
    return;
  switch (this.buf.mouseCursor) {
    case 1:
      this.telnetCore.send('\x1b[D');  //Arrow Left
      break;
    case 2:
      this.telnetCore.send('\x1b[5~'); //Page Up
      break;
    case 3:
      this.telnetCore.send('\x1b[6~'); //Page Down
      break;
    case 4:
      this.telnetCore.send('\x1b[1~'); //Home
      break;
    case 5:
      this.telnetCore.send('\x1b[4~'); //End
      break;
    case 6:
      if (this.buf.nowHighlight != -1) {
        var sendstr = '';
        if (this.buf.cur_y > this.buf.nowHighlight) {
          var count = this.buf.cur_y - this.buf.nowHighlight;
          for (var i = 0; i < count; ++i)
            sendstr += '\x1b[A'; //Arrow Up
        } else if (this.buf.cur_y < this.buf.nowHighlight) {
          var count = this.buf.nowHighlight - this.buf.cur_y;
          for (var i = 0; i < count; ++i)
            sendstr += '\x1b[B'; //Arrow Down
        }
        sendstr += '\r';
        this.telnetCore.send(sendstr);
      }
      break;
    case 7:
      var pos = this.clientToPos(cX, cY);
      var sendstr = '';
      if (this.buf.cur_y > pos.row) {
        var count = this.buf.cur_y - pos.row;
        for (var i = 0; i < count; ++i)
          sendstr += '\x1b[A'; //Arrow Up
      } else if (this.buf.cur_y < pos.row) {
        var count = pos.row - this.buf.cur_y;
        for (var i = 0; i < count; ++i)
          sendstr += '\x1b[B'; //Arrow Down
      }
      sendstr += '\r';
      this.telnetCore.send(sendstr);
      break;
    case 0:
      this.telnetCore.send('\x1b[D'); //Arrow Left
      break;
    case 8:
      this.telnetCore.send('['); //Previous post with the same title
      break;
    case 9:
      this.telnetCore.send(']'); //Next post with the same title
      break;
    case 10:
      this.telnetCore.send('='); //First post with the same title
      break;
    case 12:
      this.telnetCore.send('\x1b[D\r\x1b[4~'); //Refresh post / pushed texts
      break;
    case 13:
      this.telnetCore.send('\x1b[D\r\x1b[4~[]'); //Last post with the same title (LIST)
      break;
    case 14:
      this.telnetCore.send('\x1b[D\x1b[4~[]\r'); //Last post with the same title (READING)
      break;
    default:
      //do nothing
      break;
  }
};

pttchrome.App.prototype.overlayCommandListener = function (e) {
  var elm = e.target;
  var cmd = elm.getAttribute("pttChromeCommand");
  dumpLog(DUMP_TYPE_LOG, cmd);
  if (elm) {
    if (elm.id == 'cmdHandler') {
      switch (cmd) {
        case "doArrowUp":
          this.telnetCore.send('\x1b[A');
          break;
        case "doArrowDown":
          this.telnetCore.send('\x1b[B');
          break;
        case "doPageUp":
          this.telnetCore.send('\x1b[5~');
          break;
        case "doPageDown":
          this.telnetCore.send('\x1b[6~');
          break;
        case "prevousThread":
          this.buf.SetPageState();
          if (this.buf.PageState==2 || this.buf.PageState==3 || this.buf.PageState==4) {
            this.telnetCore.send('[');
          }
          break;
        case "nextThread":
          this.buf.SetPageState();
          if (this.buf.PageState==2 || this.buf.PageState==3 || this.buf.PageState==4) {
            this.telnetCore.send(']');
          }
          break;
        case "reloadTabIconDelay":
          this.doReloadTabIcon(100);
          break;
        case "reloadTabIcon":
          //alert('reloadTabIcon');
          this.reloadTabIcon();
          break;
        case "doAddTrack":
          this.doAddTrack();
          break;
        case "doDelTrack":
          this.doDelTrack();
          break;
        case "doClearTrack":
          this.doClearTrack();
          break;
        case "openSymbolInput":
          if (this.symbolinput) {
            this.symbolinput.setCore(this);
            this.symbolinput.displayWindow();
          }
          break;
        case "doSavePage":
          this.doSavePage();
          break;
        case "doCopyHtml":
          this.doCopyHtml();
          break;
        case "doSelectAll":
          this.doSelectAll();
          break;
        case "doCopy":
          this.doCopySelect();
          break;
        case "doPaste":
          this.doPaste();
          break;
        case "doOpenAllLink":
          this.doOpenAllLink();
          break;
        //case "doLoadUserSetting":
        //  this.doLoadUserSetting();
        //  break;
        case "switchMouseBrowsing":
          this.switchMouseBrowsing();
          break;
        case "openYoutubeWindow":
          var param = elm.getAttribute("YoutubeURL");
          elm.removeAttribute("YoutubeURL");
          if (this.playerMgr)
            this.playerMgr.openYoutubeWindow(param);
          break;
        case "openUstreamWindow":
          var param = elm.getAttribute("UstreamURL");
          elm.removeAttribute("UstreamURL");
          if (this.playerMgr)
            this.playerMgr.openUstreamWindow(param);
          break;
        case "openUrecordWindow":
          var param = elm.getAttribute("UrecordURL");
          elm.removeAttribute("UrecordURL");
          if (this.playerMgr)
            this.playerMgr.openUrecordWindow(param);
          break;
        case "previewPicture":
          var param = elm.getAttribute("PictureURL");
          elm.removeAttribute("PictureURL");
          if (this.picViewerMgr)
            this.picViewerMgr.openPicture(param);
          break;
        case "doLoadFile":
          this.buf.loadFile();
          break;
        case "doSaveFile":
          this.buf.saveFile();
          break;
        case "checkPrefExist":
          this.doSiteSettingCheck(250);
          break;
        case "pushThread":
          this.doPushThread();
          break;
        case "setAlert":
          var param = elm.getAttribute("AlertMessage");
          elm.removeAttribute("AlertMessage");
          //this.view.showAlertMessage(document.title, param);
          //alert(param);
          break;
        default:
          //e v a l("bbsfox."+cmd+"();"); //unsafe javascript? how to fix it?
          break;
      }
    }
    elm.removeAttribute("pttChromeCommand");
  }
};

pttchrome.App.prototype.onMouse_move = function(cX, cY) {
  var pos = this.clientToPos(cX, cY);
  this.buf.onMouse_move(pos.col, pos.row, false);
};

pttchrome.App.prototype.resetMouseCursor = function(cX, cY) {
  this.buf.BBSWin.style.cursor = 'auto';
  this.buf.mouseCursor = 11;
};

pttchrome.App.prototype.clearHighlight = function() {
  this.buf.clearHighlight();
};

pttchrome.App.prototype.onPrefChange = function(pref, name) {
  try {
    //var CiStr = Components.interfaces.nsISupportsString;
    //dumpLog(DUMP_TYPE_LOG, "onPrefChange " + name + ":" + pref.get(name));
    switch (name) {
    case 'useMouseBrowsing':
      var useMouseBrowsing = pref.get(name);
      this.CmdHandler.setAttribute('useMouseBrowsing', useMouseBrowsing?'1':'0');
      this.buf.useMouseBrowsing = useMouseBrowsing;

      if (!this.buf.useMouseBrowsing) {
        this.buf.BBSWin.style.cursor = 'auto';
        this.buf.clearHighlight();
        this.buf.mouseCursor = 0;
        this.buf.nowHighlight = -1;
        this.buf.tempMouseCol = 0;
        this.buf.tempMouseRow = 0;
      }
      this.buf.SetPageState();
      this.buf.resetMousePos();
      this.view.redraw(true);
      this.view.updateCursorPos();
      break;
    case 'mouseBrowsingHighlight':
      this.buf.highlightCursor = pref.get(name);
      this.view.redraw(true);
      this.view.updateCursorPos();
      break;
    case 'mouseBrowsingHighlightColor':
      this.view.highlightBG = pref.get(name);
      this.view.redraw(true);
      this.view.updateCursorPos();
      break;
    case 'closeQuery':
      if (pref.get(name))
        this.regExitAlert();
      else
        this.unregExitAlert();
      break;
    case 'antiIdleTime':
      this.antiIdleTime = pref.get(name) * 1000;
      break;
    case 'dbcsDetect':
      this.view.dbcsDetect = pref.get(name);
      break;
    case 'fontFitWindowWidth':
      this.view.fontFitWindowWidth = pref.get(name);
      if (this.view.fontFitWindowWidth) {
        $('.main').addClass('trans-fix');
      } else {
        $('.main').removeClass('trans-fix');
      }
      this.onWindowResize();
      break;
    case 'fontFace':
      var fontFace = pref.get(name);
      if (!fontFace) 
        fontFace='monospace';
      this.view.setFontFace(fontFace);
      break;
    default:
      break;
    }
  } catch(e) {
    // eats all errors
    return;
  }
};

pttchrome.App.prototype.checkClass = function(cn) {
  return (  cn.indexOf("closeSI") >=0  || cn.indexOf("EPbtn") >= 0
          || cn.indexOf("closePP") >= 0 || cn.indexOf("picturePreview") >= 0
          || cn.indexOf("drag") >= 0    || cn.indexOf("floatWindowClientArea") >= 0
          || cn.indexOf("WinBtn") >= 0  || cn.indexOf("sBtn") >= 0
          || cn.indexOf("nonspan") >= 0 );
};

pttchrome.App.prototype.mouse_click = function(e) {
  if (this.modalShown)
    return;
  var skipMouseClick = (this.CmdHandler.getAttribute('SkipMouseClick') == '1');
  this.CmdHandler.setAttribute('SkipMouseClick','0');

  if (e.button == 2) { //right button
  } else if (e.button == 0) { //left button
    if (e.target && e.target.getAttribute("link") == 'true') {
      return;
    }
    if (window.getSelection().isCollapsed) { //no anything be select
      if (this.buf.useMouseBrowsing) {
        var doMouseCommand = true;
        if (e.target.className)
          if (this.checkClass(e.target.className))
            doMouseCommand = false;
        if (e.target.tagName)
          if(e.target.tagName.indexOf("menuitem") >= 0 )
            doMouseCommand = false;
        if (skipMouseClick) {
          doMouseCommand = false;
          var pos = this.clientToPos(e.clientX, e.clientY);
          this.buf.onMouse_move(pos.col, pos.row, true);
        }
        if (doMouseCommand) {
          this.onMouse_click(e.clientX, e.clientY);
          this.setDblclickTimer();
          e.preventDefault();
          this.setInputAreaFocus();
        }
      }
    }
  } else if (e.button == 1) { //middle button
    if (e.target && e.target.parentNode) {
      if (e.target.getAttribute("link") == 'true')
        return;
    }
    if (this.view.middleButtonFunction == 1)
      this.telnetCore.send('\r');
    else if (this.view.middleButtonFunction == 2) {
      this.buf.SetPageState();
      if (this.buf.PageState == 2 || this.buf.PageState == 3 || this.buf.PageState == 4)
        this.telnetCore.send('\x1b[D');
    }
  } else {
  }
};

pttchrome.App.prototype.mouse_down = function(e) {
  if (this.modalShown)
    return;
  //0=left button, 1=middle button, 2=right button
  if (e.button == 0) {
    if (this.buf.useMouseBrowsing) {
      if (this.dblclickTimer) { //skip
        e.preventDefault();
        e.stopPropagation();
        e.cancelBubble = true;
      }
      this.setDblclickTimer();
    }
    this.mouseLeftButtonDown = true;
    //this.setInputAreaFocus();
    if (!(window.getSelection().isCollapsed))
      this.CmdHandler.setAttribute('SkipMouseClick','1');

    var onbbsarea = true;
    if (e.target.className)
      if (this.checkClass(e.target.className))
        onbbsarea = false;
    if (e.target.tagName)
      if (e.target.tagName.indexOf("menuitem") >= 0 )
        onbbsarea = false;
  } else if(e.button == 2) {
    this.mouseRightButtonDown = true;
  }
};

pttchrome.App.prototype.mouse_up = function(e) {
  if (this.modalShown)
    return;
  //0=left button, 1=middle button, 2=right button
  if (e.button == 0) {
    this.setMbTimer();
    //this.CmdHandler.setAttribute('MouseLeftButtonDown', '0');
    this.mouseLeftButtonDown = false;
  } else if (e.button == 2) {
    this.mouseRightButtonDown = false;
    //this.CmdHandler.setAttribute('MouseRightButtonDown', '0');
  }

  if (e.button == 0 || e.button == 2) { //left or right button
    if (window.getSelection().isCollapsed) { //no anything be select
      if (this.buf.useMouseBrowsing)
        this.onMouse_move(e.clientX, e.clientY);

      this.setInputAreaFocus();
      if (e.button == 0) {
        var preventDefault = true;
        if (e.target.className)
          if (this.checkClass(e.target.className))
            preventDefault = false;
        if (e.target.tagName)
          if (e.target.tagName.indexOf("menuitem") >= 0 )
            preventDefault = false;
        if (preventDefault)
          e.preventDefault();
      }
    } else { //something has be select
    }
  } else {
    this.setInputAreaFocus();
    e.preventDefault();
  }
  var _this = this;
  this.inputAreaFocusTimer = setTimer(false, function() {
    clearTimeout(_this.inputAreaFocusTimer);
    _this.inputAreaFocusTimer = null;
    if (this.modalShown)
      return;
    if (window.getSelection().isCollapsed)
      _this.setInputAreaFocus();
  }, 10);
};

pttchrome.App.prototype.mouse_move = function(e) {
  this.view.tempPicX = e.clientX;
  this.view.tempPicY = e.clientY;
  //if we draging window, pass all detect.
  if (this.playerMgr && this.playerMgr.dragingWindow) {
    var dW = this.playerMgr.dragingWindow;
    if (this.CmdHandler.getAttribute("DragingWindow") == '1') {
      dW.playerDiv.style.left = dW.tempCurX + (e.pageX - dW.offX) + 'px';
      dW.playerDiv.style.top = dW.tempCurY + (e.pageY - dW.offY) + 'px';
      e.preventDefault();
      return;
    } else if (this.CmdHandler.getAttribute("DragingWindow") == '2') {
      dW.playerDiv2.style.left = dW.tempCurX + (e.pageX - dW.offX) + 'px';
      dW.playerDiv2.style.top = dW.tempCurY + (e.pageY - dW.offY) + 'px';
      e.preventDefault();
      return;
    }
  } else if (this.picViewerMgr && this.picViewerMgr.dragingWindow) {
    var dW = this.picViewerMgr.dragingWindow;
    dW.viewerDiv.style.left = dW.tempCurX + (e.pageX - dW.offX) + 'px';
    dW.viewerDiv.style.top = dW.tempCurY + (e.pageY - dW.offY) + 'px';
    e.preventDefault();
    return;
  } else if (this.symbolinput && this.symbolinput.dragingWindow) {
    var dW = this.symbolinput.dragingWindow;
    if (this.CmdHandler.getAttribute("DragingWindow") == '3') {
      dW.mainDiv.style.left = dW.tempCurX + (e.pageX - dW.offX) + 'px';
      dW.mainDiv.style.top = dW.tempCurY + (e.pageY - dW.offY) + 'px';
      e.preventDefault();
      return;
    }
  }

  if (this.buf.useMouseBrowsing) {
    if (window.getSelection().isCollapsed) {
      if(!this.mouseLeftButtonDown)
        this.onMouse_move(e.clientX, e.clientY);
    } else
      this.resetMouseCursor();
  }
};

pttchrome.App.prototype.mouse_over = function(e) {
  if (this.modalShown)
    return;

  /*
  var parent = $(e.target).parent();
  var selector = '#hoverPPT';
  if (parent.is('a')) {
    // TODO: make it also work on comment posted urls
    var src = parent.attr('href') + '@.jpg';
    var image = new Image();
    image.onload = function() {
      $(selector).html('<img src="'+src+'"></img>')
        .show()
        .css({
          position: "absolute",
          left: function(e) {
            var mouseWidth = e.pageX;
            var pageWidth = $(window).width();
            var imageWidth = image.width;
            
            // opening image would pass the side of the page
            if (mouseWidth + imageWidth > pageWidth &&
                imageWidth < mouseWidth) {
                return mouseWidth - imageWidth;
            } 
            return mouseWidth;
          }(e),
          top: function(e) {
            var mouseHeight = e.pageY;
            var pageHeight = $(window).height();
            var imageHeight = image.height;

            // opening image would pass the bottom of the page
            if (mouseHeight + imageHeight / 2 > pageHeight - 20) {
              if (imageHeight / 2 < mouseHeight) {
                return pageHeight - 20 - imageHeight;
              } else {
                return 20;
              }
            } else if (mouseHeight - 20 < imageHeight / 2) {
              return 20;
            }
            return mouseHeight - imageHeight / 2;
          }(e)
        });
    };
    image.src = src;
  } else if (e.target.parentNode !== $(selector)[0]) {
    $(selector).hide();
  }
  */

  if(window.getSelection().isCollapsed && !this.mouseLeftButtonDown)
    this.setInputAreaFocus();
};

pttchrome.App.prototype.mouse_scroll = function(e) {
  var cmdhandler = this.CmdHandler;

  // scroll = up/down
  // hold right mouse key + scroll = page up/down
  // hold left mouse key + scroll = thread prev/next

  if (e.wheelDelta > 0) { // scrolling up
    if (this.mouseRightButtonDown) {
      this.setBBSCmd('doPageUp', cmdhandler);
    } else if (this.mouseLeftButtonDown) {
      this.setBBSCmd('prevousThread', cmdhandler);
      this.setBBSCmd('cancelHoldMouse', cmdhandler);
    } else {
      this.setBBSCmd('doArrowUp', cmdhandler);
    }
  } else { // scrolling down
    if (this.mouseRightButtonDown) {
      this.setBBSCmd('doPageDown', cmdhandler);
    } else if (this.mouseLeftButtonDown) {
      this.setBBSCmd('nextThread', cmdhandler);
      this.setBBSCmd('cancelHoldMouse', cmdhandler);
    } else {
      this.setBBSCmd('doArrowDown', cmdhandler);
    }
  }
  e.stopPropagation();
  e.preventDefault();

  if (this.mouseRightButtonDown) //prevent context menu popup
    cmdhandler.setAttribute('doDOMMouseScroll','1');
  if (this.mouseLeftButtonDown) {
    if (this.buf.useMouseBrowsing) {
      cmdhandler.setAttribute('SkipMouseClick','1');
    }
  }
};

pttchrome.App.prototype.setupContextMenus = function() {
  var self = this;
  var menuSelector = '#contextMenus';
  var selectedText = '';

  $('#BBSWindow').on('contextmenu', function(e) {
    // if i am doing scrolling, i should skip
    var cmdhandler = self.CmdHandler;
    var doDOMMouseScroll = (cmdhandler.getAttribute('doDOMMouseScroll')=='1');
    if (doDOMMouseScroll) {
      e.stopPropagation();
      e.preventDefault();
      cmdhandler.setAttribute('doDOMMouseScroll','0');
      return;
    }

    var target = e.target;
    // replace the &nbsp;
    selectedText = window.getSelection().toString().replace(/\u00a0/g, " ");
    if (window.getSelection().isCollapsed) { 
      $('#cmenu_copy').hide();
      $('#cmenu_searchGoogle').hide();

      $('#cmenu_paste').show();
      $('#cmenu_selectAll').show();
      $('#cmenu_mouseBrowsing').show();
      $('#cmenu_goToOtherSite').show();

      $('#cmenu_divider2').show();
    } else {
      // got something selected, show copy and searchGoogle
      $('#cmenu_copy').show();
      $('#cmenu_searchGoogle').show();
      $('#cmenuSearchContent').text("'"+selectedText+"'");

      $('#cmenu_paste').hide();
      $('#cmenu_selectAll').hide();
      $('#cmenu_mouseBrowsing').hide();
      $('#cmenu_goToOtherSite').hide();

      $('#cmenu_divider2').hide();
    }

    // check if mouse browsing is on
    if (self.buf.useMouseBrowsing) {
      $('#mouseBrowsingCheck').show();
    } else {
      $('#mouseBrowsingCheck').hide();
    }

    // show and position
    $(menuSelector)
      .show()
      .css({
        position: "absolute",
        left: function(e) {
          var mouseWidth = e.pageX;
          var pageWidth = $(window).width();
          var menuWidth = $(menuSelector).width();
          
          // opening menu would pass the side of the page
          if (mouseWidth + menuWidth > pageWidth &&
              menuWidth < mouseWidth) {
              return mouseWidth - menuWidth;
          } 
          return mouseWidth;
        }(e),
        top: function(e) {
          var mouseHeight = e.pageY;
          var pageHeight = $(window).height();
          var menuHeight = $(menuSelector).height();

          // opening menu would pass the bottom of the page
          if (mouseHeight + menuHeight > pageHeight &&
              menuHeight < mouseHeight) {
              return mouseHeight - menuHeight;
          } 
          return mouseHeight;
        }(e)
      });
    self.contextMenuShown = true;
    return false;
  });

  var hideContextMenu = function() {
    $(menuSelector).hide();
    selectedText = '';
    self.contextMenuShown = false;
  };

  //make sure menu closes on any click
  $(window).click(function() {
    hideContextMenu();
  });

  $('#cmenu_copy a').html(i18n('cmenu_copy')+'<span class="cmenuHotkey">Ctrl+C</span>');
  $('#cmenu_paste a').html(i18n('cmenu_paste')+'<span class="cmenuHotkey">Ctrl+Shift+V</span>');
  $('#cmenu_selectAll a').text(i18n('cmenu_selectAll'));
  $('#cmenu_searchGoogle a').html(i18n('cmenu_searchGoogle')+' <span id="cmenuSearchContent"></span>');
  $('#cmenu_mouseBrowsing a').html('<i id="mouseBrowsingCheck" class="fa fa-check"></i>'+i18n('cmenu_mouseBrowsing'));
  $('#cmenu_goToOtherSite a').text(i18n('cmenu_goToOtherSite'));
  $('#cmenu_settings a').text(i18n('cmenu_settings'));

  $('#cmenu_copy').click(function(e) {
    self.doCopy(selectedText);
    e.stopPropagation();
    hideContextMenu();
  });
  $('#cmenu_paste').click(function(e) {
    self.doPaste();
    e.stopPropagation();
    hideContextMenu();
  });
  $('#cmenu_selectAll').click(function(e) {
    self.doSelectAll();
    e.stopPropagation();
    hideContextMenu();
  });
  $('#cmenu_searchGoogle').click(function(e) {
    self.doSearchGoogle(selectedText);
    e.stopPropagation();
    hideContextMenu();
  });
  $('#cmenu_mouseBrowsing').click(function(e) {
    self.switchMouseBrowsing();
    e.stopPropagation();
    hideContextMenu();
  });
  $('#cmenu_goToOtherSite').click(function(e) {
    self.doGoToOtherSite();
    e.stopPropagation();
    hideContextMenu();
  });
  $('#cmenu_settings').click(function(e) {
    self.doSettings();
    e.stopPropagation();
    hideContextMenu();
  });

  $(menuSelector).on('contextmenu', function(e) {
    e.stopPropagation();
    e.preventDefault();
  });
};

pttchrome.App.prototype.context_menu = function(e) {
  var cmdhandler = this.CmdHandler;
  var doDOMMouseScroll = (cmdhandler.getAttribute('doDOMMouseScroll')=='1');
  if (doDOMMouseScroll) {
    e.stopPropagation();
    e.preventDefault();
    cmdhandler.setAttribute('doDOMMouseScroll','0');
    return;
  }
};

pttchrome.App.prototype.window_beforeunload = function(e) {
  //e.returnValue = confirm('Are you sure you want to leave '+document.title+'?');
  e.returnValue = true;
  return document.title;
};

pttchrome.App.prototype.regExitAlert = function() {
  this.unregExitAlert();
  this.alertBeforeUnload = true;
  window.addEventListener('beforeunload', this.window_beforeunload, false);
};

pttchrome.App.prototype.unregExitAlert = function() {
  // clear alert for closing tab
  if (this.alertBeforeUnload) {
    this.alertBeforeUnload = false;
    window.removeEventListener('beforeunload', this.window_beforeunload, false);
  }
};

pttchrome.App.prototype.setBBSCmd = function(cmd, cmdhandler) {
  //var doc = gBrowser.contentDocument;
  var doc = document;
  if (!cmdhandler)
    cmdhandler = this.getCmdHandler();

  if (cmdhandler && "createEvent" in doc) {
    cmdhandler.setAttribute('pttChromeCommand', cmd);
    var evt = doc.createEvent("Events");
    evt.initEvent("OverlayCommand", false, false);
    cmdhandler.dispatchEvent(evt);
  }
};
