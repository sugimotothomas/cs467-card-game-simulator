import { 
    addTableObject, 
    cardNames,
    createSprite, 
    isDragging, 
    stackVisualEffect, 
    wasDragging,
    frames
} from './cards.js';

// Updates all the objects on the table
export function updateTableObjects(self, objectsInfo) {
  Object.keys(objectsInfo).forEach(function (id) {
    if(objectsInfo[id] != null) {
      var updatedAnObject = false;
      var count = 0;
      self.tableObjects.getChildren().forEach(function (object) {
        // Check if server has object
        if(objectsInfo[object.objectId] == null) {
          // Check if it's being or was recently dragged
          if(isDragging != object.objectId && wasDragging != object.objectId) {
            object.removeAll(true);
            object.destroy();
          }
        }

        // Check if object is same as server's object
        else if(object.objectId == id) {
          updateObject(self, 
                       objectsInfo[id].x, 
                       objectsInfo[id].y, 
                       objectsInfo[id].objectDepth, 
                       objectsInfo[id].angle,
                       objectsInfo[id].items,
                       objectsInfo[id].isFaceUp,
                       object);
          updatedAnObject = true;
          count++;
        } 
      });

      if(count > 1)
        console.log("Error: Found " + count + " of the same object id when updating from server");

      // If no object was updated, there is no local object and must be created
      if(!updatedAnObject && isDragging != id) {
        addTableObject(self, objectsInfo[id].items, objectsInfo[id].x, objectsInfo[id].y, objectsInfo[id].isFaceUp);
      }
    }
  });

  // Double check for duplicates
  self.tableObjects.getChildren().forEach(function (object) {
    if(objectsInfo[object.objectId] == null) {
      // Check if it's being or was recently dragged
      if(isDragging != object.objectId && wasDragging != object.objectId) {
        object.removeAll(true);
        object.destroy();
      }
    }
  });
}

// Updates a single table object
export function updateObject(self, xPos, yPos, objectDepth, angle, items, isFaceUp, object) {
  if(!object) { 
    console.log("No local object to update.");
    return;
  }
  object.active = true;
  object.setVisible(true);
  object.objectId = items[0];

  // Check if it is not being currently dragged or drawn
  if(isDragging != object.objectId && wasDragging != object.objectId) {
    // Check if it's not in the same position
    if(object.x != xPos || object.y != yPos) {
      // Update position
      object.setPosition(xPos, yPos);
    }
    // Check if different depth
    if(object.depth != objectDepth) {
      // Update Depth
      object.depth = objectDepth;
    }

    object.angle = angle;
  }
  // Update all sprites (regardless if its being dragged)
  for (var i = 0; i < Math.max(object.length, items.length); i++) {
    var serverSpriteId = items[i];
    if(i >= object.length) {
      // Create a new sprite
      var newSprite = createSprite(self, serverSpriteId, cardNames[serverSpriteId], isFaceUp[i]);
      object.add(newSprite); // Add at end of list
    }
    else if(i >= items.length) {
      // Delete Sprite
      object.removeAt(i, true);
    }
    else {
      var spriteToUpdate = object.getAt(i);

      // Update the sprite
      updateSprite(spriteToUpdate, serverSpriteId, isFaceUp[i]);

      // Stack's Parallax Visual Effect 
      stackVisualEffect(self, spriteToUpdate, angle, i, items.length-1);
    }
  }
  return object;
}

// Update a sprite
export function updateSprite(oldSprite, newId, newIsFaceUp) {
  if(oldSprite) {
    oldSprite.spriteId = newId;
    oldSprite.name = cardNames[newId];
    if(newIsFaceUp) 
      oldSprite.setFrame(frames[frames.indexOf(cardNames[newId])]);
    else
      oldSprite.setFrame(frames[frames.indexOf('back')]);
    oldSprite.isFaceUp = newIsFaceUp;
  }
}