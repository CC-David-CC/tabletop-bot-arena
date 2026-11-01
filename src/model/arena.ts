import * as RAPIER from "@dimforge/rapier3d-compat";
import type {RigidBody,World} from "@dimforge/rapier3d-compat";

export const TICK_MS=1000/60;
export const MATCH_TICKS=90*60;
export const ARENA_LIMIT=6.4;
export const MAX_HEALTH=100;
export const MAX_ENERGY=100;
export const WEAPON_COOLDOWN=48;
export const DAMAGE_COOLDOWN=24;
export const BUILD_FINGERPRINT="three-0.187.0-rapier-0.21.0";
export const SAVE_FORMAT="ksu.game.save";
export const SAVE_APP_ID="tabletop-bot-arena";

export type RobotPreset="wedge"|"lifter"|"spinner";
export type MatchMode="practice"|"cup";
export type Result="playing"|"won"|"lost"|"cup-win";
export type DriveCommand={forward:number;right:number};

export const ROBOT_PRESETS:Readonly<Record<RobotPreset,{name:string;damage:number;speed:number;color:number}>>={
  wedge:{name:"Wedge",damage:8,speed:1.1,color:0x72b7e6},
  lifter:{name:"Lifter",damage:12,speed:.9,color:0xe1b55b},
  spinner:{name:"Spinner",damage:16,speed:.78,color:0xe57b69}
};

export const OPPONENTS=[
  {name:"Tin Scout",personality:"cautious",aggression:.72,speed:1.02},
  {name:"Brass Bruiser",personality:"aggressive",aggression:1,speed:.92},
  {name:"Clockwork Captain",personality:"technical",aggression:.9,speed:1.08}
] as const;

export interface RobotSnapshot{
  bodyHandle:number;
  x:number;
  y:number;
  vx:number;
  vy:number;
  health:number;
  energy:number;
  weaponCooldown:number;
  damageCooldown:number;
  weaponTicks:number;
  selfRightReady:boolean;
}

export interface ArenaSnapshot{
  buildFingerprint:string;
  worldSnapshot:number[];
  tick:number;
  matchTicksLeft:number;
  preset:RobotPreset;
  mode:MatchMode;
  opponentIndex:number;
  cupWins:number;
  cupRound:number;
  result:Result;
  paused:boolean;
  player:RobotSnapshot;
  opponent:RobotSnapshot;
  rngState:number;
}

export interface CupProgress{
  buildFingerprint:string;
  preset:RobotPreset;
  mode:MatchMode;
  opponentIndex:number;
  cupWins:number;
  cupRound:number;
  paused:true;
}

interface Combatant{
  body:RigidBody;
  health:number;
  energy:number;
  weaponCooldown:number;
  damageCooldown:number;
  weaponTicks:number;
  selfRightReady:boolean;
}

let rapierPromise:Promise<void>|null=null;
const ensureRapier=()=>rapierPromise??=RAPIER.init();
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

export class ArenaSession{
  readonly ready:Promise<void>;
  paused=true;
  result:Result="playing";
  tick=0;
  readonly preset:RobotPreset;
  readonly mode:MatchMode;
  opponentIndex:number;
  cupWins:number;
  cupRound:number;
  private matchTicksLeft=MATCH_TICKS;
  private rngState:number;
  private world:World|null=null;
  private player:Combatant|null=null;
  private opponent:Combatant|null=null;
  private aiCooldown=0;
  private disposed=false;
  private restore?:ArenaSnapshot;

  constructor(options:{preset?:RobotPreset;mode?:MatchMode;opponentIndex?:number;cupWins?:number;cupRound?:number;seed?:number;snapshot?:ArenaSnapshot}={}){
    this.preset=options.snapshot?.preset??options.preset??"wedge";
    this.mode=options.snapshot?.mode??options.mode??"practice";
    this.opponentIndex=options.snapshot?.opponentIndex??options.opponentIndex??0;
    this.cupWins=options.snapshot?.cupWins??options.cupWins??0;
    this.cupRound=options.snapshot?.cupRound??options.cupRound??1;
    this.rngState=options.snapshot?.rngState??(options.seed??Date.now())>>>0;
    this.restore=options.snapshot;
    this.ready=this.initialize();
  }

  private async initialize(){
    if(this.restore?.buildFingerprint!==undefined&&this.restore.buildFingerprint!==BUILD_FINGERPRINT)throw Error("Tabletop Bot Arena build fingerprint mismatch.");
    await ensureRapier();if(this.disposed)return;
    if(this.restore){this.applySnapshot(this.restore);return;}
    this.createWorld();
  }

  private requireWorld(){if(!this.world)throw Error("Arena world is not ready.");return this.world}
  private spawnRobot(x:number,y:number,color:number){
    const world=this.requireWorld();
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,.42).setLinearDamping(.68).setAngularDamping(1).lockRotations());
    world.createCollider(RAPIER.ColliderDesc.cuboid(.55,.42,.28).setDensity(.9).setFriction(.4).setRestitution(.18),body);
    world.createCollider(RAPIER.ColliderDesc.cuboid(.48,.13,.22).setTranslation(0,-.55,.02).setDensity(.55).setFriction(.25).setRestitution(.3),body);
    return {body,health:MAX_HEALTH,energy:MAX_ENERGY,weaponCooldown:0,damageCooldown:0,weaponTicks:0,selfRightReady:true,color};
  }
  private createWorld(){
    this.world=new RAPIER.World({x:0,y:0,z:0});
    this.world.timestep=TICK_MS/1000;
    const player=this.spawnRobot(-3.7,0,ROBOT_PRESETS[this.preset].color);
    const opponent=this.spawnRobot(3.7,0,this.mode==="practice"?0x7d8792:OPPONENTS[this.opponentIndex].aggression>0.95?0xcf6555:0x8da8bf);
    this.player=player;this.opponent=opponent;
    this.tick=0;this.matchTicksLeft=MATCH_TICKS;this.paused=true;this.result="playing";
  }

  start(){if(this.result==="playing"){this.paused=false;this.clearHeldInput()}}
  pause(){this.paused=true;this.clearHeldInput()}
  clearHeldInput(){if(!this.player)return;this.player.weaponTicks=0;}
  restart(){if(this.world){this.world.free();this.world=null}this.createWorld()}

  drivePlayer(command:DriveCommand){
    if(!this.player)return false;return this.applyDrive(this.player,command,ROBOT_PRESETS[this.preset].speed);
  }
  driveOpponent(command:DriveCommand){
    if(!this.opponent)return false;return this.applyDrive(this.opponent,command,this.mode==="practice"?0:OPPONENTS[this.opponentIndex].speed);
  }
  private applyDrive(combatant:Combatant,command:DriveCommand,speed:number){
    if(this.paused||this.result!=="playing")return false;
    const forward=clamp(Number.isFinite(command.forward)?command.forward:0,-1,1),right=clamp(Number.isFinite(command.right)?command.right:0,-1,1);
    const magnitude=Math.hypot(forward,right);if(magnitude<.01)return false;
    const scale=speed*.115/Math.max(1,magnitude);
    combatant.body.applyImpulse({x:right*scale,y:forward*scale,z:0},true);
    return true;
  }
  activatePlayerWeapon(){return this.activateWeapon(this.player,ROBOT_PRESETS[this.preset].damage)}
  activateOpponentWeapon(){return this.activateWeapon(this.opponent,ROBOT_PRESETS.spinner.damage)}
  private activateWeapon(combatant:Combatant|null,damage:number){
    if(!combatant||this.paused||this.result!=="playing"||combatant.weaponCooldown>0||combatant.energy<12)return false;
    combatant.weaponCooldown=WEAPON_COOLDOWN;combatant.weaponTicks=24;combatant.energy=Math.max(0,combatant.energy-12);return true;
  }
  selfRight(){if(!this.player||this.paused||this.result!=="playing"||!this.player.selfRightReady)return false;this.player.selfRightReady=false;this.player.body.applyImpulse({x:0,y:.25,z:0},true);return true}

  private nextRandom(){this.rngState=(Math.imul(1664525,this.rngState)+1013904223)>>>0;return this.rngState/0x100000000}
  private position(combatant:Combatant){return combatant.body.translation()}
  private applyHit(attacker:Combatant,target:Combatant,baseDamage:number){
    if(attacker.weaponTicks<=0||target.damageCooldown>0)return false;
    const a=this.position(attacker),b=this.position(target),dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
    if(distance>1.45)return false;
    const impulse=distance>.001?{x:dx/distance*.68,y:dy/distance*.68,z:0}:{x:.68,y:0,z:0};
    target.body.applyImpulse(impulse,true);
    target.health=Math.max(0,target.health-baseDamage);
    target.damageCooldown=DAMAGE_COOLDOWN;
    return true;
  }
  private finish(result:Result){this.result=result;this.paused=true;this.clearHeldInput();if(result==="won"&&this.mode==="cup")this.cupWins=Math.min(3,this.cupWins+1)}
  private checkOutcome(){
    if(!this.player||!this.opponent||this.result!=="playing")return;
    const p=this.position(this.player),o=this.position(this.opponent);
    if(this.player.health<=0||Math.hypot(p.x,p.y)>ARENA_LIMIT+1.1)this.finish("lost");
    else if(this.opponent.health<=0||Math.hypot(o.x,o.y)>ARENA_LIMIT+1.1)this.finish(this.mode==="cup"&&this.cupWins+1>=3?"cup-win":"won");
    else if(this.matchTicksLeft<=0)this.finish(this.player.health>this.opponent.health?"won":this.player.health<this.opponent.health?"lost":"lost");
  }

  step(){
    if(this.paused||this.result!=="playing"||this.disposed)return;
    const world=this.requireWorld(),player=this.player!,opponent=this.opponent!;
    if(this.mode!=="practice"&&--this.aiCooldown<=0){
      const p=this.position(player),o=this.position(opponent),dx=p.x-o.x,dy=p.y-o.y,distance=Math.hypot(dx,dy),personality=OPPONENTS[this.opponentIndex];
      if(distance>1.45)this.driveOpponent({forward:clamp(dy/(distance||1),-.9,.9),right:clamp(dx/(distance||1),-.9,.9)});
      else if(personality.aggression>this.nextRandom()*.7)this.activateOpponentWeapon();
      this.aiCooldown=10+Math.floor(this.nextRandom()*18);
    }
    world.step();this.tick++;this.matchTicksLeft=Math.max(0,this.matchTicksLeft-1);
    for(const robot of [player,opponent]){
      robot.weaponCooldown=Math.max(0,robot.weaponCooldown-1);robot.damageCooldown=Math.max(0,robot.damageCooldown-1);
      if(robot.weaponTicks>0){robot.weaponTicks--;robot.energy=Math.max(0,robot.energy-.12)}
      if(robot.weaponTicks===0&&robot.energy<MAX_ENERGY)robot.energy=Math.min(MAX_ENERGY,robot.energy+.035);
    }
    this.applyHit(player,opponent,ROBOT_PRESETS[this.preset].damage);
    this.applyHit(opponent,player,ROBOT_PRESETS.spinner.damage);
    this.checkOutcome();
  }

  advanceCup(){
    if(this.mode!=="cup"||this.result!=="won")return false;
    this.opponentIndex=Math.min(OPPONENTS.length-1,this.opponentIndex+1);this.cupRound=Math.min(3,this.cupWins+1);
    if(this.world){this.world.free();this.world=null}this.createWorld();return true;
  }
  robotViews(){
    const view=(combatant:Combatant|null)=>{if(!combatant)throw Error("Arena robot is unavailable.");const p=this.position(combatant),v=combatant.body.linvel();return{x:p.x,y:p.y,vx:v.x,vy:v.y,health:combatant.health,energy:combatant.energy,weapon:combatant.weaponTicks>0,cooldown:combatant.weaponCooldown}};
    return{player:view(this.player),opponent:view(this.opponent)};
  }
  placeCombatantsForTest(playerX:number,playerY:number,opponentX:number,opponentY:number){
    if(!this.player||!this.opponent)throw Error("Arena robots are unavailable.");
    this.player.body.setTranslation({x:playerX,y:playerY,z:.42},true);
    this.opponent.body.setTranslation({x:opponentX,y:opponentY,z:.42},true);
    this.player.body.setLinvel({x:0,y:0,z:0},true);this.opponent.body.setLinvel({x:0,y:0,z:0},true);
  }
  status(){return{mode:this.mode,preset:this.preset,opponent:this.mode==="practice"?"Practice dummy":OPPONENTS[this.opponentIndex].name,personality:this.mode==="practice"?"stationary":OPPONENTS[this.opponentIndex].personality,matchSeconds:Math.ceil(this.matchTicksLeft/60),cupRound:this.cupRound,cupWins:this.cupWins,result:this.result,paused:this.paused}}
  private snapshotRobot(combatant:Combatant):RobotSnapshot{const p=this.position(combatant),v=combatant.body.linvel();return{bodyHandle:combatant.body.handle,x:p.x,y:p.y,vx:v.x,vy:v.y,health:combatant.health,energy:combatant.energy,weaponCooldown:combatant.weaponCooldown,damageCooldown:combatant.damageCooldown,weaponTicks:combatant.weaponTicks,selfRightReady:combatant.selfRightReady}}
  snapshot():ArenaSnapshot{
    const world=this.requireWorld();if(!this.player||!this.opponent)throw Error("Arena robots are unavailable.");
    return{buildFingerprint:BUILD_FINGERPRINT,worldSnapshot:Array.from(world.takeSnapshot()),tick:this.tick,matchTicksLeft:this.matchTicksLeft,preset:this.preset,mode:this.mode,opponentIndex:this.opponentIndex,cupWins:this.cupWins,cupRound:this.cupRound,result:this.result,paused:true,player:this.snapshotRobot(this.player),opponent:this.snapshotRobot(this.opponent),rngState:this.rngState};
  }
  cupProgress():CupProgress{return{buildFingerprint:BUILD_FINGERPRINT,preset:this.preset,mode:this.mode,opponentIndex:this.opponentIndex,cupWins:this.cupWins,cupRound:this.cupRound,paused:true}}
  private applySnapshot(s:ArenaSnapshot){
    this.world=RAPIER.World.restoreSnapshot(new Uint8Array(s.worldSnapshot));
    const player=this.world.bodies.get(s.player.bodyHandle),opponent=this.world.bodies.get(s.opponent.bodyHandle);
    if(!player||!opponent)throw Error("Saved arena robots are incomplete.");
    this.player={body:player,health:s.player.health,energy:s.player.energy,weaponCooldown:s.player.weaponCooldown,damageCooldown:s.player.damageCooldown,weaponTicks:0,selfRightReady:s.player.selfRightReady};
    this.opponent={body:opponent,health:s.opponent.health,energy:s.opponent.energy,weaponCooldown:s.opponent.weaponCooldown,damageCooldown:s.opponent.damageCooldown,weaponTicks:0,selfRightReady:s.opponent.selfRightReady};
    this.tick=s.tick;this.matchTicksLeft=s.matchTicksLeft;this.opponentIndex=s.opponentIndex;this.cupWins=s.cupWins;this.cupRound=s.cupRound;this.result=s.result;this.paused=true;this.rngState=s.rngState;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.player=null;this.opponent=null;this.world?.free();this.world=null}
}

export class ArenaSaveError extends Error{constructor(reason:string){super("tabletop-bot-arena save rejected: "+reason);this.name="ArenaSaveError"}}
export function encodeMatchSave(session:ArenaSession){return JSON.stringify({format:SAVE_FORMAT,schemaVersion:1,appId:SAVE_APP_ID,kind:"match-snapshot",contentVersion:"1",payload:session.snapshot()})}
export function encodeCupSave(session:ArenaSession){return JSON.stringify({format:SAVE_FORMAT,schemaVersion:1,appId:SAVE_APP_ID,kind:"cup-progress",contentVersion:"1",payload:session.cupProgress()})}
export function decodeSave(text:string,maxBytes=32*1024*1024):{kind:"match-snapshot";payload:ArenaSnapshot}|{kind:"cup-progress";payload:CupProgress}{
  if(new TextEncoder().encode(text).byteLength>maxBytes)throw new ArenaSaveError("document exceeds size limit");
  let value:any;try{value=JSON.parse(text)}catch{throw new ArenaSaveError("document is not valid JSON")}
  if(value?.format!==SAVE_FORMAT||value?.schemaVersion!==1||value?.appId!==SAVE_APP_ID||value?.contentVersion!=="1")throw new ArenaSaveError("wrong envelope");
  const preset=value.payload?.preset,mode=value.payload?.mode;
  if(!["wedge","lifter","spinner"].includes(preset)||!["practice","cup"].includes(mode))throw new ArenaSaveError("invalid robot or mode");
  const int=(x:unknown,min=0,max=1e9)=>Number.isSafeInteger(x)&&(x as number)>=min&&(x as number)<=max;
  if(value.kind==="cup-progress"){
    const p=value.payload;if(p.buildFingerprint!==BUILD_FINGERPRINT||!int(p.opponentIndex,0,2)||!int(p.cupWins,0,3)||!int(p.cupRound,1,3)||p.paused!==true)throw new ArenaSaveError("invalid cup progress");return{kind:"cup-progress",payload:p};
  }
  if(value.kind!=="match-snapshot")throw new ArenaSaveError("unknown document kind");
  const p=value.payload,handle=(x:unknown)=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=Number.MAX_SAFE_INTEGER,robot=(r:any)=>r&&handle(r.bodyHandle)&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&Number.isFinite(r.vx)&&Number.isFinite(r.vy)&&Number.isFinite(r.health)&&r.health>=0&&r.health<=MAX_HEALTH&&Number.isFinite(r.energy)&&r.energy>=0&&r.energy<=MAX_ENERGY&&int(r.weaponCooldown,0,WEAPON_COOLDOWN)&&int(r.damageCooldown,0,DAMAGE_COOLDOWN)&&int(r.weaponTicks,0,24)&&typeof r.selfRightReady==="boolean";
  if(p.buildFingerprint!==BUILD_FINGERPRINT||!Array.isArray(p.worldSnapshot)||p.worldSnapshot.length<8||!p.worldSnapshot.every((x:unknown)=>int(x,0,255))||!int(p.tick)||!int(p.matchTicksLeft,0,MATCH_TICKS)||!int(p.opponentIndex,0,2)||!int(p.cupWins,0,3)||!int(p.cupRound,1,3)||!["playing","won","lost","cup-win"].includes(p.result)||p.paused!==true||!int(p.rngState,0,0xffffffff)||!robot(p.player)||!robot(p.opponent))throw new ArenaSaveError("invalid match snapshot");
  return{kind:"match-snapshot",payload:p};
}
