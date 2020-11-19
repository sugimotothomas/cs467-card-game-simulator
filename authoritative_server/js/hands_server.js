function moveObjectToHand(self, object, playerId, pos) {
  if(!object || !players[playerId]) {
    return;
  }
  //console.log("Moved " + cardNames[object.objectId] + " to " + players[playerId].name + "'s hand.");

  var numSprites = object.length; // Number of sprites in the object
  
  for(var i = 0; i < numSprites; i++) {
    var sprite = object.first;      // Get sprite object
    // Update hand info for client
    players[playerId].hand.splice(pos, 0, sprite.spriteId);  
    players[playerId].isFaceUp.splice(pos, 0, sprite.isFaceUp);     
    //players[hand.playerId].isFaceUp.splice(pos, 0, true); // Always flip the card

    object.remove(sprite, true);    // Remove sprite from container
  }
  updateHandSpacing(playerId, -1);      // Adjust spacing

  delete objectInfoToSend[object.objectId]; // Delete object info for client
  object.active = false; // Save for later
}

// Go through all the cards in the hand and update the position
function updateHandSpacing(playerId, ignorePos) {
  if(!players[playerId]) {
    console.log("Cannot update hand spacing (playerId not found).");
    return;
  }
  if(ignorePos == null)
    ignorePos = -1;
  var rotation = Phaser.Math.DegToRad(-players[playerId].playerSpacing);
  var newLength = players[playerId].hand.length;
  var deltaLen = ignorePos == -1 ? newLength : newLength-1;
  var deltaI = 0; 

  var startPos, spacing = HAND_SPACING;
  if(spacing * deltaLen >= HAND_WIDTH - 30)
    spacing = (HAND_WIDTH-CARD_WIDTH) / deltaLen;
  if(deltaLen % 2 == 1)
    startPos = -spacing * Math.floor(deltaLen/2.0);
  else
    startPos = -spacing * Math.floor(deltaLen/2.0) + spacing/2;

  for(var i = 0; i < newLength; i++) {
    if(i == ignorePos) 
      deltaI = 1; // Shift i for every card after ignorePos
    else {
      // Compensate for rotation and translation
      var handX = players[playerId].x + Math.cos(rotation) * (startPos + spacing * (i-deltaI));
      var handY = players[playerId].y + Math.sin(rotation) * (startPos + spacing * (i-deltaI));
      players[playerId].handX[i] = handX;
      players[playerId].handY[i] = handY;
    }
  }
}

// Get the position of cards not accounting for rotation and translation
function getHandSpacing(playerId, pos, length) {
  var rotation = Phaser.Math.DegToRad(-players[playerId].playerSpacing);
  var handXPos = players[playerId].x;
  var cardXPos = players[playerId].handX[pos];
  return (cardXPos - handXPos) / Math.cos(rotation);
}


function takeFromHand(self, socket, playerId, objectId, x, y) {
  const player = players[playerId];
  if(!player) {
    console.log("Cannot take card from hand (playerId not found).");
    return;
  }
  // Locked hands (other players cant take cards from your hand)
  else if(options["lockedHands"] && (playerId != socket.id)) {
    return;
  }
  var isFaceUp;
  var pos = -1;
  for(var i = 0; i < players[playerId].hand.length; i++) {
    if(players[playerId].hand[i] == objectId) {
      pos = i;
      players[playerId].hand.splice(i, 1); // Remove from hand
      isFaceUp = players[playerId].isFaceUp.splice(i, 1);
      break;
    }
  }
  if(pos == -1) {
    console.log("Cannot take " + cardNames[objectId] + " from " + player.name + "'s hand.");
    return;
  }
  else if(options["flipWhenExitHand"]) 
     isFaceUp = false;
  overallDepth++;
  updateHandSpacing(playerId, -1);      // Adjust spacing in hand

  //re-define the stack and put its sprite back into it
  const sprite = createSprite(self, objectId, cardNames[objectId], isFaceUp, frames);
  const object = getTableObject(self, objectId); //find the original stack that the sprite was created with
  object.active = true;
  object.x = x;
  object.y = y;
  object.angle = -players[playerId].playerSpacing;
  object.objectId = objectId;
  object.add(sprite);

  //update clients telling them to create the new stack
  objectInfoToSend[object.objectId]={
    objectId: object.objectId,
    items: [ objectId ],
    isFaceUp: [ isFaceUp ],
    x: x,
    y: y,
    objectDepth: overallDepth,
    angle: -players[playerId].playerSpacing
  }
  //console.log('Card ' + cardNames[objectId] + ' taken from ' + players[playerId].name + 'hand');
}



function flipHandObject(self, objectId, playerId) {
  var pos = -1;
  for(var i = 0; i < players[playerId].hand.length; i++) {
    if(players[playerId].hand[i] == objectId) {
      pos = i;
      players[playerId].isFaceUp[i] = !players[playerId].isFaceUp[i];
      break;
    }
  }
}

function setHandObjectPosition(self, socket, playerId, objectId, x, y) {
  if(!players[playerId]) {
    console.log("Cannot set card position in hand (playerId not found).");
    return;
  }
  for(var i = 0; i < players[playerId].hand.length; i++) {
    if(players[playerId].hand[i] == objectId && (!options["lockedHands"] || (playerId == socket.id))) {
      players[playerId].handX[i] = x;
      players[playerId].handY[i] = y;
      updateHandSpacing(playerId, i); // Fan other cards in hand and ignore dragging card
      break;
    }
  }
}


function moveAroundInHand(self, playerId, objectId, newPos) {
  if(!players[playerId])
    return;
  if(newPos == -1) { // Reset spacing
    updateHandSpacing(playerId, -1);
    return;
  }
  var pos = -1; 
  for(var i = 0; i < players[playerId].hand.length; i++) {
    if(players[playerId].hand[i] == objectId) {
      pos = i;  // Current position of card
      break;  
    }
  }
  if(pos == -1) {
    console.log("Cannot move card around.");
    return;
  }
  else if(pos == newPos || pos + 1 == newPos) { // Same position dont do anything
    updateHandSpacing(playerId, -1);
    return;
  }
  else if(pos < 0)
    pos = 0;
  
  var x = players[playerId].handX[pos];
  var y = players[playerId].handY[pos];
  var isFaceUp = players[playerId].isFaceUp[pos];
  var toDelete = newPos > pos ? pos : pos+1;
  // Insert copy into new position
  players[playerId].hand.splice(newPos, 0, objectId); 
  players[playerId].handX.splice(newPos, 0, x);
  players[playerId].handY.splice(newPos, 0, y);
  players[playerId].isFaceUp.splice(newPos, 0, isFaceUp);

  // Remove original
  players[playerId].hand.splice(toDelete, 1); 
  players[playerId].handX.splice(toDelete, 1);
  players[playerId].handY.splice(toDelete, 1);
  players[playerId].isFaceUp.splice(toDelete, 1);

  updateHandSpacing(playerId, -1);
}

function removeAllFromHand(self, playerId) {
  var x = 350;
  var y = 500;
  const player = players[playerId];
  if(!player) {
    console.log("Cannot remove card from hand (playerId not found).");
    return;
  }
  for(var i = 0; i < players[playerId].hand.length; i++) {
    var objectId = players[playerId].hand[i];
    var isFaceUp = players[playerId].isFaceUp[i];
    //var isFaceUp = false; // Hide cards

    //re-define the stack and put its sprite back into it
    const sprite = createSprite(self, objectId, cardNames[objectId], isFaceUp, frames);
    const object = getTableObject(self, objectId); //find the original stack that the sprite was created with
    object.active = true;
    object.x = x;
    object.y = y;
    object.angle = 0;
    object.objectId = objectId;
    object.add(sprite);

    overallDepth++;
    //update clients telling them to create the new stack
    objectInfoToSend[object.objectId]={
      objectId: object.objectId,
      items: [ objectId ],
      isFaceUp: [ isFaceUp ],
      x: x,
      y: y,
      objectDepth: overallDepth,
      angle: -players[playerId].playerSpacing
    }
    x += 20;
  }
}