import { 
    MENU_DEPTH,
    CARD_WIDTH,
    CARD_HEIGHT,
    frames,
    cardNames,
    isDragging,
    draggingObj,
    drewAnObject,
    addObject,
    rotateObject,
    setDrewAnObject,
    addTableObject,
    setDraggingObj,
    options
} from './cards.js';

import { 
    updateObject
} from './update.js';


// CONSTANTS
const HAND_WIDTH = 400;
const HAND_HEIGHT = 150;
const HAND_SPACING = 50;

// GLOBAL VARIABLES
export const hands = {};      // Object with information about players hands

// Create an object for the hand. Must have only one spriteId and spriteOrientation
function addHandObject(self, playerId, pos, angle, spriteId, x, y, isFaceUp) {
  const isMe = playerId == self.socket.id;
  var object = addObject(self, [spriteId], x, y, [isFaceUp]);
  if(!isMe && isFaceUp) // Hide the card if not me
    object.first.setFrame(frames[frames.indexOf('joker')]); // Joker placeholder
  object.playerId = playerId;   // Player the card belongs to
  object.pos = pos;             // Position in the hand
  object.angle = angle;

  self.handObjects.add(object); // Add to hands group       
  return object;
}

export function addHand(self, playerId, xPos, yPos, hand, isFaceUp, angle) {
  // Temp box to show the size of the hands (Visual only)
  var handZone = self.add.rectangle(xPos, yPos, HAND_WIDTH, HAND_HEIGHT, 0x6666ff);
  handZone.playerId = playerId;             // The player associated with the hand
  handZone.angle = angle;
  handZone.depth = 0;
  // Inner zone which detects when a card is over it
  var snapZone = self.add.rectangle(xPos, yPos, HAND_WIDTH - CARD_WIDTH, HAND_HEIGHT - CARD_HEIGHT, 0xff4c4c);
  snapZone.playerId = playerId;
  snapZone.angle = angle;
  snapZone.depth = 0;
  self.handSnapZones.add(snapZone);

  hands[playerId] = {
    playerId: playerId,
    zone: handZone,   // Rectangle Game object for hand zone
    size: 0             // How many cards in hand
  }
}

export function updateHand(self, playerId, xPos, yPos, spriteIds, objectXs, objectYs, isFaceUp, angle) {
  if(!hands[playerId]) {
    console.log("Cannot update hand, " + hand.playerId + " not found.");
    return;
  }
  // Update hand snap zone
  if(hands[playerId].zone.x != xPos || hands[playerId].zone.y != yPos || hands[playerId].zone.angle != angle) {
    self.handSnapZones.getChildren().forEach(function (zone) {
      if(zone.playerId == playerId) {
        zone.x = xPos;
        zone.y = yPos;
        zone.angle = angle;
      }
    }); 
  }
  // Update hand zone rectangle
  hands[playerId].zone.x = xPos;
  hands[playerId].zone.y = yPos;
  hands[playerId].zone.angle = angle;
  hands[playerId].size = spriteIds.length;

  var rotation = Phaser.Math.DegToRad(angle);
  // Loop through server list
  for(var i = 0; i < spriteIds.length; i++) {
    var serverSpriteId = spriteIds[i];
    var serverIsFaceUp = isFaceUp[i];
    var serverX = objectXs[i];
    var serverY = objectYs[i];
    var hasUpdated = false;

    // Loop through local game objects
    self.handObjects.getChildren().forEach(function (handObject) {
      if(handObject.objectId == serverSpriteId) {
        // Update object in the hand
        updateHandObject(self, handObject, playerId, i, angle, serverSpriteId, serverX, serverY, serverIsFaceUp);
        hasUpdated = true;
      }
    });

    if(!hasUpdated) {
      // Create Object
      addHandObject(self, playerId, i, angle, serverSpriteId, serverX, serverY, serverIsFaceUp);
    }
  }
  // Check for objects not in list and delete
  self.handObjects.getChildren().forEach(function (object) {
    if(object.playerId == playerId && spriteIds[object.pos] != object.objectId &&
       isDragging != object.objectId
    ) {
      console.log("deleting in updateHand()")
      object.removeAll(true); 
      object.destroy();
    }
  });
}

// Looks for the a handzone and inserts into it
export function checkSnapToHand(self, object) {
  var hand = findClosestHandZone(self, object);
  // Add to empty hand
  if(hand && hand.size == 0) {
    moveObjectToHand(self, object, hand, 0);
    return true;
  }
  if(hand) {
    var pos = findPosToInsertInHand(self, object);
    if(pos != -1) {
      moveObjectToHand(self, object, hand, pos);
      return true;
    }
  }
  return false;
}

// Returns the hand object if the pointer is over it. otherwise null
function findClosestHandZone(self, object) {
  var closestHand = null;
  var objBounds = object.getBounds();
  self.handSnapZones.getChildren().forEach(function (zone) {
    var zoneBounds = zone.getBounds();
    if(Phaser.Geom.Intersects.RectangleToRectangle(objBounds, zoneBounds))
      closestHand = hands[zone.playerId];
  }); 
  return closestHand;
}

// Move a whole stack to the hand
function moveObjectToHand(self, object, hand, pos) {
  self.socket.emit('objectToHand', { 
    objectId: object.objectId,
    playerId: hand.playerId,
    pos: pos
  });

  // ** UPDATE LOCALLY
}

function takeFromHand(self) {
  const playerId = draggingObj.playerId; 
  if(!playerId) {
    console.log("Cannot take card from hand draggingObj=" + cardNames[draggingObj.objectId]);
    return;
  }
  // Locked hands (other players cant take cards from your hand)
  else if(options["lockedHands"] && (playerId != self.socket.id)) {
    return;
  }
  setDrewAnObject(true);
  //drewAnObject = true;   
  const spriteId = draggingObj.first.spriteId;
  var isFaceUp = draggingObj.first.isFaceUp;
  if(options["flipWhenExitHand"]) 
    isFaceUp = false;  // Always flip the card over when taking
  const x = draggingObj.x;
  const y = draggingObj.y;
  
  self.socket.emit('handToTable', { 
    objectId: draggingObj.objectId,
    playerId: playerId,
    x: x,
    y: y
  });
  
  draggingObj.active = false;       // Hide object to be deleted in updateHand
  draggingObj.setVisible(false);
  var newObj = setDraggingObj(addTableObject(self, [spriteId], x, y, [isFaceUp]));
  newObj.depth = MENU_DEPTH-1;

  //console.log("Taking " + cardNames[draggingObj.objectId] + " from hand");
}


function updateHandObject(self, object, playerId, pos, angle, spriteId, x, y, isFaceUp) {
  var updated = updateObject(self, x, y, pos+5, angle, [spriteId], [isFaceUp], object);
  const isMe = self.socket.id == playerId;
  if(!isMe && isFaceUp) {
    console.log("card " + cardNames[spriteId]);
    updated.first.setFrame(frames[frames.indexOf('joker')]);
  }
  updated.playerId = playerId;
  updated.pos = pos;
  return updated;
}

export function flipHandObject(self, object) {
  self.socket.emit('objectFlip', { 
    objectId: object.objectId,
    playerId: object.playerId
  });

  // Flip the top sprite for appearences
  var sprite = object.first;
  if(!sprite.isFaceUp) 
    sprite.setFrame(frames[frames.indexOf(cardNames[sprite.spriteId])]);
  else
    sprite.setFrame(frames[frames.indexOf('back')]);   
}

export function checkForHandZone(self, gameObject, dragX, dragY) {
  var objBounds = gameObject.getBounds();
  var foundHandZone = false;
  self.handSnapZones.getChildren().forEach(function (zone) {
    var zoneBounds = zone.getBounds();
    if(zone.playerId == gameObject.playerId && Phaser.Geom.Intersects.RectangleToRectangle(objBounds, zoneBounds)) {
      foundHandZone = true;
      dragHandObject(self, gameObject, dragX, dragY);
    }
  }); 
  
  if(
    !foundHandZone &&                   // Not in a handZone
    gameObject === draggingObj && 
    !drewAnObject 
  ) {
    takeFromHand(self);
  }
}

function dragHandObject(self, gameObject, dragX, dragY){
  if(gameObject) {
    // Locally changes the object's position
    gameObject.x = dragX;
    gameObject.y = dragY;
    gameObject.depth = MENU_DEPTH-1;

    rotateObject(self, gameObject);

    // Send the input to the server
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      playerId: gameObject.playerId,
      x: dragX, 
      y: dragY 
    });
  }
}

// Change the position of cards in the hand
export function moveAroundInHand(self, object) {
  var pos = findPosToInsertInHand(self, object);

  self.socket.emit('handToHand', { 
    objectId: object.objectId,
    playerId: object.playerId,
    pos: pos  // Position to move to
  });

    //**UPDATE LOCALLY
    
  //console.log("Moving card to pos " + pos + " in hand.");
}

function findPosToInsertInHand(self, object) {
  var closest = null;
  var dist = 500;
  var secondClosest = null;
  var dist2 = 500;

  self.handObjects.getChildren().forEach(function (handObject) {
    if(handObject.objectId != object.objectId) {
      var tempDistance = Phaser.Math.Distance.BetweenPoints(object, handObject);
      if(tempDistance < dist) {
        secondClosest = closest;
        closest = handObject;
        dist2 = dist;
        dist = tempDistance;
      } 
      else if(tempDistance < dist2) {
        secondClosest = handObject;
        dist2 = tempDistance;
      }
    }
  });

  if(closest) {
    //console.log("closest="+closest.first.name + " secondClosest=" + secondClosest.first.name);
    var hand = hands[closest.playerId];
    var angle = Phaser.Math.DegToRad(hand.zone.angle);
    var isLeftOfClosest = Math.cos(angle) * (object.x-closest.x) + Math.sin(angle) * (object.y-closest.y) < 0;
  
    // Two handObjects are near
    if(secondClosest && closest.playerId == secondClosest.playerId) {
      var leftPos = Math.min(closest.pos, secondClosest.pos);
      var rightPos = Math.max(closest.pos, secondClosest.pos);
      var isLeftOfSecondClosest = Math.cos(angle) * (object.x-secondClosest.x) + Math.sin(angle) * (object.y-secondClosest.y) < 0;
      
      if(isLeftOfClosest && isLeftOfSecondClosest) 
        return leftPos;        // Left of both cards
      else if(!isLeftOfClosest && !isLeftOfSecondClosest)
        return rightPos+1;     // Right of both cards
      else 
        return rightPos;       // Between the cards
    }
    else {  // Only one card thats near
      if(isLeftOfClosest)
        return closest.pos;    // Left of card
      else
        return closest.pos+1;  // Right of card
    }
  }
  return -1; // No objects close enough
}