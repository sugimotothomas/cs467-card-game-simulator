
var config = {
  type: Phaser.AUTO,
  parent: 'game-area',
  dom: {
    createContainer: true
  },
  // Initial dimensions based on window size
  width: window.innerWidth*.8,
  height: window.innerHeight,
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

// List of all the current players in the game 
var players = {};

// The id of an object being currently dragged. -1 if not
var isDragging = -1;

// This player's info
var playerNickname = getParameterByName('nickname');
// Room's infrom from url query
const roomName = '/' + getParameterByName('roomId');

var game = new Phaser.Game(config);

function preload() {
  this.load.html('nameform', 'assets/nameform.html');
  this.load.html('menu', 'assets/menu.html');
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {
  var self = this;
  this.socket = io(roomName);

  var backgroundColor = this.cameras.main.setBackgroundColor('#3CB371');
  console.log(backgroundColor);

  if(playerNickname)
    self.socket.emit('playerNickname', playerNickname);

  // Not in use (implemented in lobby) Keep for reference
  //showNicknamePrompt(self);

  this.tableObjects = this.add.group();
  
  loadMenu(self);
  loadCards(self);
  startSocketUpdates(self);
}

function update() {}

// Gets url parameters/queries for a name and returns the value
function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function loadMenu(self) {
  var menu = self.add.text(20, 10, 'Menu', { 
    color: 'White',
    font: 'bold 34px Arial', 
    align: 'left',
    backgroundColor: "Black"
  }).setInteractive();

  menu.depth = 1000;

  menu.on('pointerdown', function() {
    var element = self.add.dom(self.cameras.main.centerX, self.cameras.main.centerY).createFromCache('menu');

    $('#user-name').val(playerNickname);

    $('#menu-form').submit(function(e) {
      e.preventDefault();
      var newColor = $('#background').val();
      if(newColor != self.backgroundColor) {
        self.backgroundColor = self.cameras.main.setBackgroundColor(newColor);
        self.socket.emit('backgroundColor', newColor);
      }
      newNickname = $('#user-name').val();
      if(playerNickname != newNickname) {
        playerNickname = newNickname;
        self.socket.emit('playerNickname', playerNickname);
      }
    });

    self.input.keyboard.on('keyup-ESC', function (event) {
      element.destroy();
    });

    $('#exit-menu').click(function() {
      element.destroy();
    });
  });
}

function loadCards(self) {
  let frames = self.textures.get('cards').getFrameNames();
  
  let cardNames = ['back', 
    'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
    'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
    'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
    'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
    'joker'
  ];

  //add 52 playing cards in order
  for (let i = 1; i <= 52; i++) {
    let nextCard = frames[frames.indexOf(cardNames[i])];
    addObject(self, i, cardNames[i], nextCard);
  }

  // Add joker card
  var jokerFrame = frames[frames.indexOf("joker")];
  addObject(self, 53, 'joker', jokerFrame);

  // for Thomas this doesnt work
  self.input.mouse.disableContextMenu();

  // Right Click for flip
  self.input.on('pointerdown', function (pointer, targets) {
    if (pointer.rightButtonDown() && targets[0] != null) {
      var orientation = true; // true is face up
      if (targets[0].name == targets[0].frame.name) { //if target cardName == frame name, flip it to back
        // Locally flips the card
        targets[0].setFrame(frames[frames.indexOf("back")]);
        orientation = false;
      } 
      else { //otherwise flip card to front
        // Locally flips the card
        targets[0].setFrame(frames[frames.indexOf(targets[0].objectName)]);
      }
      
      // Send info to server
      self.socket.emit('objectFlip', { 
        objectId: targets[0].objectId,
        isFaceUp: orientation
      });
    }
  });

  // Only pick up the top object
  self.input.topOnly = true;

  // When the mouse starts dragging the object
  self.input.on('dragstart', function (pointer, gameObject) {
    gameObject.setTint(0xff0000);
    isDragging = gameObject.objectId;
    // Tells the server to increase the object's depth and bring to front
    gameObject.depth = 999;
    self.socket.emit('objectDepth', { 
      objectId: gameObject.objectId
    });
  });
  
  // While the mouse is dragging
  self.input.on('drag', function (pointer, gameObject, dragX, dragY) {
    // Locally changes the object's position
    gameObject.x = dragX;
    gameObject.y = dragY;

    // update to server on "objectInput"
    // This sends the input to the server
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      x: dragX, 
      y: dragY 
    });
  });
  
  // When the mouse finishes dragging
  self.input.on('dragend', function (pointer, gameObject) {
    gameObject.setTint(0x00ff00);
    gameObject.clearTint();
    // Waits since there might be lag so last few inputs that the
    // player sends to the server before they put the card down
    // would move the cards
    self.time.delayedCall(500, function() {
      isDragging = -1;
    });
  });  

  // Start the object listener for commands from server
  self.socket.on('objectUpdates', function (objectsInfo) {
    
    var allTableObjects = self.tableObjects.getChildren();
    Object.keys(objectsInfo).forEach(function (id) {
      var obj = allTableObjects[id-1];
      if(obj)
        updateObjects(objectsInfo, id, obj, frames);
    });
    
    /*
    // This is wasteful, it iterates all the tableobjects
    Object.keys(objectsInfo).forEach(function (id) {
      self.tableObjects.getChildren().forEach(function (object) {
        // Compares local players to auth server's players
        //   ▼ auth players          ▼ local players
        if (objectsInfo[id].objectId === object.objectId) {
          updateObjects(objectsInfo, id, object, frames);
        }
      });
    });
    */
  });
}

function updateObjects(objectsInfo, id, object, frames) {
    // Check if it is not being currently dragged and it's not in the same position
  if(isDragging != object.objectId && 
    (object.x != objectsInfo[id].x || object.y != objectsInfo[id].y)) {
    // Updates position
    object.setPosition(objectsInfo[id].x, objectsInfo[id].y);
    object.depth = objectsInfo[id].objectDepth;
  }
  if(object.depth != objectsInfo[id].objectDepth)
    object.depth = objectsInfo[id].objectDepth;
  if(objectsInfo[id].isFaceUp) { // server says face up
    // check if the card not up
    if(object.frame.name != frames[frames.indexOf(object.name)]) {
      object.setFrame(frames[frames.indexOf(object.name)]);
    }
  } else { // face down
    // check if the card is not down
    if(object.frame.name != "back") {
      object.setFrame(frames[frames.indexOf("back")]);
    }
  }
}

function startSocketUpdates(self) {
  // Get background color
  self.socket.on('backgroundColor', function(color) {
    console.log(color);
    self.backgroundColor = self.cameras.main.setBackgroundColor(color);
  });

  // Gets the list of current players from the server
  self.socket.on('currentPlayers', function (playersInfo) {
    players = playersInfo;
  });

  // Setup Chat
  $('#chat-form').submit(function(e) {
    e.preventDefault(); // prevents page reloading
    self.socket.emit('chat message', playerNickname + ': ' + $('#chat-msg').val());
    $('#chat-msg').val('');
    return false;
  });

  self.socket.on('chat message', function(msg){
    $('#messages').append($('<li>').text(msg));
  });
}

/*
// At the start of the game it asks the player to enter a nickname
function showNicknamePrompt(self) {
  var text = self.add.text(self.cameras.main.centerX-150, self.cameras.main.centerY-100, 
    'Please enter a nickname:', { 
      color: 'Black', 
      boundsAlignH: 'center',
      fontFamily: 'Arial', 
      fontSize: '32px '
  });
  text.depth = 1000;
  var element = self.add.dom(self.cameras.main.centerX, self.cameras.main.centerY).createFromCache('nameform');
  element.setPerspective(800);
  element.addListener('click');

  $('#nickname-form').submit(function(e) {
    e.preventDefault(); // prevents page reloading
    var inputNickname = $('#nickname').val();
    $('#nickname').val('');
    if(inputNickname !== '') {
      // Fade Out
      self.tweens.add({
        targets: element,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: function() {
          element.setVisible(false);
          element.destroy();
        }
      }, this);
      playerNickname = inputNickname;
      //  Populate the text with whatever they typed in as the username
      text.destroy();
      // Send to server
      self.socket.emit('playerNickname', playerNickname);
    } else {
      //  Flash the prompt
      self.tweens.add({ targets: text, alpha: 0.1, duration: 200, ease: 'Power3', yoyo: true });
    }
    return false;
  });
}
*/

function addObject(self, objectId, objectName, frame) {
  // Create object
  // No physics for client side
  const object = self.add.sprite(0, 0, 'cards', frame).setInteractive();

  // Assign the individual game object an id and name
  object.objectId = objectId;
  object.name = objectName;

  self.input.setDraggable(object);

  // Add it to the object group
  self.tableObjects.add(object);
  
  // Change color on hover
  object.on('pointerover', function () {
    this.setTint(0x00ff00);
  });
  object.on('pointerout', function () {
    this.clearTint();
  });
}

