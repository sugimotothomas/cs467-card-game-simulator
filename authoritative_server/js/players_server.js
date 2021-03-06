  
const customCursors = [
  {inUse: false, path: 'blue'},
  {inUse: false, path: 'green'},
  {inUse: false, path: 'orange'},
  {inUse: false, path: 'pink'},
  {inUse: false, path: 'purple'},
  {inUse: false, path: 'red'},
  {inUse: false, path: 'white'},
  {inUse: false, path: 'yellow'}
];

function addPlayer(self, socket) {
  numPlayers++;
  playerCounter++;
  players[socket.id] = {
    playerId: socket.id,
    name: "player" + playerCounter,
    playerNum: playerCounter,       // player's number that's not long
    hand: [],                    // All the ids of the cards in the hand
    handX: [],
    handY: [],                   // location of the cards in the hand
    isFaceUp: [],
    depth: -1,                   // objectId of the ONE object being currently dragged (-1 if not)
    x: TABLE_CENTER_X,
    y: TABLE_CENTER_Y,
    playerSpacing: 0,
    playerCursor: selectPlayerCursor()
  }

  console.log('[Room ' +  roomCode + '] ' +
              'Player ' + players[socket.id].playerNum + 
              ' (' + players[socket.id].name + ') connected');
}

function removePlayer(self, socket) {
  numPlayers--;
  removeAllFromHand(self, socket.id);
  deselectPlayerCursor(players[socket.id].playerCursor);
  
  console.log('[Room ' +  roomCode + '] '+
              'Player ' + players[socket.id].playerNum + 
              ' (' + players[socket.id].name + ') disconnected');
  delete players[socket.id];
}

function selectPlayerCursor(){
  let playerCursor = null;
  for (let i = 0; i < customCursors.length; i++) {
    if(!customCursors[i].inUse){
      playerCursor = customCursors[i];
      customCursors[i].inUse = true;
      break;
    }
  }
  if(playerCursor){
    return playerCursor.path;
  }
  else{
    console.log('more players than cursors');
    return customCursors[0].path;
  }
}

function deselectPlayerCursor(playerCursor){
  for (let i = 0; i < customCursors.length; i++) {
    if(customCursors[i].path == playerCursor){
      customCursors[i].inUse = false;
      break;
    }
  }
}