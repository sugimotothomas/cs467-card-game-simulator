import { players } from './game.js';
import { 
    updateTableObjects,
    updateSprite,
    updateObject
} from './update.js';

import { 
    checkForHandZone,
    checkSnapToHand,
    moveAroundInHand,
    flipHandObject
} from './hands.js';

// CONSTANTS
export const MENU_DEPTH = 1000;
export const CURSOR_DEPTH = 950;
const STACK_SNAP_DISTANCE = 40;
const LONG_PRESS_TIME = 300;
export const CARD_WIDTH = 70;
export const CARD_HEIGHT = 95;

// GLOBAL VARIABLES
export const cardNames = ['back', 
  'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
  'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
  'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
  'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
  'joker'
];
export let frames;            // Global pointer to the card texture frames
export var isDragging = -1;   // The id of an object being currently dragged. -1 if not
export var wasDragging = -1;  // Obj id that was recently dragged. For lag compensation.
export var draggingObj = null;    // The pointer to the object being currently dragged
export var drewAnObject = false;  // Keep track if you drew an item so you don't draw multiple
var hoveringObj = null;       // Pointer to the object being hovered over (null if not)
export var options = {};      // Options for the game

export function loadCards(self) {
  frames = self.textures.get('cards').getFrameNames();
  self.input.mouse.disableContextMenu();
  // Only pick up the top object
  self.input.topOnly = true;
  
  self.input.on('pointerover', function(pointer, justOver){
    hoveringObj = justOver[0];
  });  

  self.input.on('pointermove', function(pointer, currentlyOver){
    hoveringObj = currentlyOver[0];
  }); 

  self.input.on('pointerout', function(pointer, justOut){
    hoveringObj = null;
  });

  self.input.on('pointerdown', function (pointer, currentlyOver) {
    if (pointer.rightButtonDown()) {
      var object = currentlyOver[0];
      flipTableObject(self, object);
    }
    //console.log("Clicking on: " + currentlyOver[0].spriteId);
  });

  // When the mouse starts dragging the object
  self.input.on('dragstart', function (pointer, gameObject) {
    isDragging = gameObject.objectId;
    draggingObj = gameObject;
    //console.log("Dragging " + cardNames[draggingObj.first.spriteId]);
    if(!options["lockedHands"] || (!draggingObj.playerId || draggingObj.playerId == self.socket.id))
      draggingObj.depth = MENU_DEPTH-1;
    self.socket.emit('objectDepth', { // Tells the server to increase the object's depth
      objectId: gameObject.objectId
    });
  });
  
  // While the mouse is dragging
  self.input.on('drag', function (pointer, gameObject, dragX, dragY) {
    if( 
        gameObject === draggingObj && 
        !drewAnObject &&
        draggingObj.length > 1 && 
        pointer.moveTime - pointer.downTime < LONG_PRESS_TIME
        // This makes the deck slightly drag when drawing from it
        //&& pointer.getDistance() > 5
    ) {
      drawTopSprite(self);
    } 
    // Dragging table object
    if(self.tableObjects.contains(draggingObj))
      dragTableObject(self, draggingObj, dragX, dragY);
    // Dragging hand object
    else if(
        self.handObjects.contains(draggingObj) && 
        // Can't drag other players
        (!options["lockedHands"] || (!draggingObj.playerId || draggingObj.playerId == self.socket.id))
    ) {
      checkForHandZone(self, draggingObj, dragX, dragY); 
    }
  });
  
  // When the mouse finishes dragging
  self.input.on('dragend', function (pointer, gameObject) {

    if(!onObjectDrop(self, draggingObj)) {    // Dropping on table/on other cards on table
      if(self.tableObjects.contains(draggingObj))
        checkSnapToHand(self, draggingObj);   // Dropping into hand
      else
        moveAroundInHand(self, draggingObj);  // Change position in hand
    }

    wasDragging = isDragging;
    isDragging = -1; 
    draggingObj = null;
    drewAnObject = false;

    setTimeout(function() { 
      wasDragging = -1;
    }, 300);
  });  

  //shuffle stacToShuffle on R key
  self.input.keyboard.on('keyup_R', function () {
    if(hoveringObj && self.tableObjects.contains(hoveringObj)) {
      shuffleStack(self, hoveringObj);
    }
  });

  self.input.keyboard.on('keyup_F', function (event) {
    if(hoveringObj && self.tableObjects.contains(hoveringObj)) 
      flipTableObject(self, hoveringObj);
    else if(hoveringObj && self.handObjects.contains(hoveringObj)) 
      flipHandObject(self, hoveringObj);
  });

  // Start the object listener for commands from server
  self.socket.on('objectUpdates', function (objectsInfo) {
    updateTableObjects(self, objectsInfo);
  });

  self.socket.on('options', function (optionsInfo) {
    options = optionsInfo;
  });
}

export function addTableObject(self, spriteIds, x, y, spriteOrientations) {
  var object = addObject(self, spriteIds, x, y, spriteOrientations);
  self.tableObjects.add(object);
  return object;
}

// May have multiple sprites for an object (in the case of a stack)
export function addObject(self, spriteIds, x, y, spriteOrientations) {
  const spritesToAdd = []; // Array of sprite objects to add to stack container
  // first spriteId will always equal the objectId
  for(let i = 0; i < spriteIds.length; i++) {
      var spriteId = spriteIds[i];
      spritesToAdd[i] = createSprite(self, spriteId, cardNames[spriteId], spriteOrientations[i]);

      // Stack's Parallax Visual Effect 
      stackVisualEffect(spritesToAdd[i], i, spriteIds.length-1);
  }
  // Create a stack-like object (can have multiple sprites in it)/(No physics for client side)
  const object = self.add.container(x, y, spritesToAdd); // Server will move it with 'ObjectUpdates'
  object.objectId = spriteIds[0];  // First spriteId is always objectId
  object.setSize(CARD_WIDTH, CARD_HEIGHT);
  object.setInteractive();         // Make interactive with mouse
  self.input.setDraggable(object);

  //console.log("creating obj id=" + spriteIds[0] + " name=" + cardNames[spriteIds[0]] + " numSprites=" + spritesToAdd.length);
  return object;
}

export function createSprite(self, spriteId, spriteName, isFaceUp) {
  var frame;
  if(isFaceUp)
    frame = frames[frames.indexOf(spriteName)];
  else
    frame = frames[frames.indexOf('back')];
  // Create sprite
  const sprite = self.add.sprite(0, 0, 'cards', frame);
  sprite.spriteId = spriteId;
  sprite.name = spriteName;
  sprite.displayWidth = CARD_WIDTH;
  sprite.displayHeight = CARD_HEIGHT;
  sprite.isFaceUp = isFaceUp;

  return sprite;
}

// Updates all the sprites in an object stack with the parallax visual effect
function updateStackVisualEffect(self, object) {
  var pos = 0;
  var size = object.length-1;
  object.getAll().forEach(function (sprite) {
    stackVisualEffect(sprite, pos, size);
    pos++;
  });
}

// Makes a stack of cards look 3D
export function stackVisualEffect(sprite, pos, size) {
  if(sprite) {
    sprite.x = -Math.floor((size-pos)/12);
    sprite.y = Math.floor((size-pos)/5);
  }
}

// Called when an object is dropped
function onObjectDrop(self, gameObject) {
  // Find closest object to snap to
  var closest = findSnapObject(self, gameObject);
  if(closest) {
    // Move top card to bottom card's position
    gameObject.x = closest.x;
    gameObject.y = closest.y;

    // Tell server to merge the two stacks
    self.socket.emit('mergeStacks', { 
      topStack: gameObject.objectId,
      bottomStack: closest.objectId
    });
    self.socket.emit('objectInput', { 
      objectId: closest.objectId,
      x: closest.x, 
      y: closest.y 
    });

    // Locally merge
    const topSprites = gameObject.getAll();
    for(var i = 0; i < topSprites.length; i++) {
      var oldSprite = gameObject.getAt(i);
      // You have to create a new sprite. Adding the oldSprite crashes phaser.
      var newSprite = createSprite(self, oldSprite.spriteId, oldSprite.name, oldSprite.isFaceUp);
      closest.add(newSprite); // Copy sprites to bottom stack
    }

    updateStackVisualEffect(self, closest);

    // Delete top stack
    gameObject.removeAll(true);
    gameObject.destroy();  
    return true;
  } 
  else return false;
}
  
// Finds the first object within the snap distance, returns null if there are none
function findSnapObject(self, gameObject) {
  var closestObj = null;
  var distance = STACK_SNAP_DISTANCE;
  self.tableObjects.getChildren().forEach(function (tableObject) {
    if (gameObject !== tableObject) {
      var tempDistance = Phaser.Math.Distance.BetweenPoints(gameObject, tableObject);
      if(tempDistance < distance) {
      closestObj = tableObject;
      distance = tempDistance;
      }
    }
  });
  return closestObj;
}
  
// Updates the global variable draggingObj
function drawTopSprite(self){
  // Make sure you only draw once
  self.socket.emit('drawTopSprite', {
    bottomStack: draggingObj.objectId
  });

  let drawnSpriteId = draggingObj.last.spriteId;
  draggingObj.remove(draggingObj.last, true);

  draggingObj = addTableObject(self, [drawnSpriteId], draggingObj.x, draggingObj.y, [draggingObj.last.isFaceUp]);
  //rotateObject(self, draggingObj);
  draggingObj.depth = MENU_DEPTH-1;
  wasDragging = isDragging;
  isDragging = draggingObj.objectId;
  
  drewAnObject = true;
}



function dragTableObject(self, gameObject, dragX, dragY){
  if(gameObject) {
    // Locally changes the object's position
    gameObject.x = dragX;
    gameObject.y = dragY;
    gameObject.depth = MENU_DEPTH-1;

    rotateObject(self, draggingObj);

    // Send the input to the server
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      x: dragX, 
      y: dragY 
    });
  }
}

export function rotateObject(self, gameObject) {
  var player = players[self.socket.id];
  if(gameObject.angle != -player.playerSpacing) {
    gameObject.angle = -player.playerSpacing;

    self.socket.emit('objectRotation', { 
      objectId: gameObject.objectId,
      angle: gameObject.angle
    });
  }
}

function shuffleStack(self, object){
  if(object && object.length > 1){
    //console.log('shuffling stack');
    self.socket.emit('shuffleStack', {
      objectId: object.objectId
    });
  }
} 

function flipTableObject(self, gameObject) {
  if(gameObject) {
    self.socket.emit('objectFlip', { 
      objectId: gameObject.objectId
    });
    
    if(gameObject.length == 1) {
      // Flip the top sprite for appearences
      var sprite = gameObject.first;
      if(!sprite.isFaceUp) 
        sprite.setFrame(frames[frames.indexOf(cardNames[sprite.spriteId])]);
      else
        sprite.setFrame(frames[frames.indexOf('back')]); 
    } 
    else {
      gameObject.objectId = gameObject.last.spriteId;
      for (var i = 0; i < Math.floor(gameObject.length * 0.5); i++) {
        var lowerSprite = gameObject.getAt(i);
        var upperSprite = gameObject.getAt(gameObject.length - 1 - i);
        var lowerSpriteId = lowerSprite.spriteId;
        var upperSpriteId = upperSprite.spriteId;
        var lowerOrientation = !lowerSprite.isFaceUp;
        var upperOrientation = !upperSprite.isFaceUp;

        // Flip the values
        updateSprite(lowerSprite, upperSpriteId, upperOrientation, frames);
        updateSprite(upperSprite, lowerSpriteId, lowerOrientation, frames);

        gameObject.getAt(i).isFaceUp = !gameObject.getAt(i).isFaceUp;
      }
    }
  }
}

export function setDrewAnObject(setting) {
  drewAnObject = setting;
}

export function setDraggingObj(object) {
  //draggingObj.active = false;       // Hide object to be deleted in updateHand
  draggingObj.setVisible(false);
  draggingObj.setActive(false);
  
  isDragging = object.objectId;
  draggingObj = object;             // Reassign dragging object
  draggingObj.depth = MENU_DEPTH-1; // Bring to front
  return draggingObj;
}