const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 100;
const rooms = new Map();

const questions = [
  {id:1,text:'Before anything else… what should we call you?'},
  {id:2,text:"Be honest—if you had to describe your life after 10th class in just one sentence, what would you say?"},
  {id:3,text:"What is something you thought you'd definitely accomplish before leaving high school… but still haven't?"},
  {id:4,text:'Close your eyes for a second and think about school. What’s the first memory that comes to your mind?'},
  {id:5,text:"What's one school moment you'd happily experience again if you had the chance?"},
  {id:6,text:"And what's one moment you'd erase from your memory if you could?"},
  {id:7,text:"Who was someone in school who changed your life—even if they probably don't realize it?"},
  {id:8,text:"What's something you never said to someone at school, but sometimes wish you had?"},
  {id:9,text:'When you look at your school life now, what do you think you’ll miss the most?'},
  {id:10,text:'What’s something about you that changed between entering high school and leaving it?'},
  {id:11,text:'If you could send one message to your 10th-class self, what would you say?'},
  {id:12,text:"What's one thing you wish your classmates understood about you?"},
  {id:13,text:'If everyone in this game had to describe you using one word, what word do you think they’d choose?'},
  {id:14,text:"What's one thing you did in school that you'll probably never tell your parents about?"},
  {id:15,text:'If you could relive exactly one day from school, which day would you choose—and why?'},
  {id:16,text:'Who do you think understands you better than you realize?'},
  {id:17,text:'What is one thing you are afraid you’ll forget about school as you get older?'},
  {id:18,text:'Imagine everyone here is reading your answers five years from now. What would you want them to know about you?'},
  {id:19,text:"Forget what you're supposed to say. What do you genuinely think your life is going to look like after school?"},
  {id:20,text:'Last one. Who do you think actually created this game—and why do you think they made it?'}
];

function makeRoom(){let code;do{code=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(code));rooms.set(code,{host:null,players:new Map(),current:1,lastActive:Date.now()});return code}
function cleanRooms(){const now=Date.now();for(const [code,r] of rooms){if(!r.host&&r.players.size===0&&now-r.lastActive>24*60*60*1000)rooms.delete(code)}}
setInterval(cleanRooms,60*60*1000).unref();
function state(r){return JSON.stringify({type:'state',current:r.current,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,answers:p.answers,connected:!!p.ws&&p.ws.readyState===1})),questions})}
function broadcast(r){r.lastActive=Date.now();const msg=state(r);if(r.host?.readyState===1)r.host.send(msg);for(const p of r.players.values())if(p.ws?.readyState===1)p.ws.send(msg)}
function send(ws,obj){if(ws.readyState===1)ws.send(JSON.stringify(obj))}

wss.on('connection',ws=>{let role=null,room=null,player=null;
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
  if(m.type==='host_create'){const code=makeRoom();room=rooms.get(code);room.host=ws;role='host';send(ws,{type:'host_ready',code,questions,maxPlayers:MAX_PLAYERS});broadcast(room);return}
  if(m.type==='host_rejoin'){room=rooms.get(String(m.code||'').toUpperCase());if(!room){send(ws,{type:'error',message:'Room not found or expired.'});return}role='host';room.host=ws;send(ws,{type:'host_ready',code:String(m.code).toUpperCase(),questions,maxPlayers:MAX_PLAYERS});broadcast(room);return}
  if(m.type==='player_join'){room=rooms.get(String(m.code||'').toUpperCase());if(!room){send(ws,{type:'error',message:'Room not found.'});return}if(room.players.size>=MAX_PLAYERS){send(ws,{type:'error',message:`This room is full (${MAX_PLAYERS} players).`});return}const id=crypto.randomBytes(8).toString('hex');player={id,name:String(m.name||'Player').trim().slice(0,40)||'Player',answers:{},ws};room.players.set(id,player);role='player';send(ws,{type:'player_ready',id,code:String(m.code).toUpperCase()});broadcast(room);return}
  if(m.type==='set_question'&&role==='host'&&room){room.current=Math.max(1,Math.min(questions.length,Number(m.question)||1));broadcast(room);return}
  if(m.type==='submit'&&role==='player'&&room&&player){const q=Math.max(1,Math.min(questions.length,Number(m.question)||1));player.answers[q]=String(m.answer||'').slice(0,4000);broadcast(room);return}
 });
 ws.on('close',()=>{if(role==='player'&&room&&player){player.ws=null;broadcast(room)}else if(role==='host'&&room?.host===ws){room.host=null;broadcast(room)}})
});
server.listen(PORT,()=>console.log(`High School Game running on port ${PORT}`));
