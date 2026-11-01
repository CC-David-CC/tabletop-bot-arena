import * as THREE from "three";
import {ArenaAudio} from "../audio/synth.js";
import {
  ARENA_LIMIT,
  ArenaSession,
  MATCH_TICKS,
  OPPONENTS,
  ROBOT_PRESETS,
  TICK_MS,
  decodeSave,
  encodeCupSave,
  encodeMatchSave,
  type ArenaSnapshot,
  type CupProgress,
  type DriveCommand,
  type MatchMode,
  type RobotPreset,
} from "../model/arena.js";

interface Host{
  signal:AbortSignal;
  w:{launchContext?:{version?:number;storage:string;path:string;owner:string};title?:string;ownerSub?:string;tabletopBotArena?:{dirty:boolean}};
  ui:{
    make(tag:string,className?:string,text?:string):HTMLElement;
    textButton(label:string,action:()=>void,className?:string):HTMLButtonElement;
    appInput(label:string,value?:string):HTMLInputElement;
    confirm(message:string,options?:{title?:string;confirmLabel?:string;cancelLabel?:string;danger?:boolean;signal?:AbortSignal}):Promise<boolean>;
  };
  storage:{
    signedInSubject():string;
    mirrorFileContext():Promise<{valid():boolean;path(value:string):string;name(value:string):string;files:{
      read(path:string):Promise<{data:Uint8Array;version:string;status:string}>;
      stat?(path:string):Promise<{version:string;status:string}>;
      write(path:string,data:Uint8Array,version?:string|null):Promise<{version:string;status:string}>;
      subscribe?(fn:()=>void):()=>void;
    }}>;
    pickFile(options:{extensions:string[];signal?:AbortSignal}):Promise<string|null>;
    pickFolder(options:{signal?:AbortSignal}):Promise<string|null>;
  };
}

export interface ViewHandle{element:HTMLElement;dispose():void}

export async function startView(host:Host,signal:AbortSignal):Promise<ViewHandle>{
  const {make,textButton,appInput}=host.ui,owner=host.storage.signedInSubject();
  host.w.ownerSub=owner;host.w.tabletopBotArena??={dirty:false};
  const element=make("section","arena-view"),toolbar=make("div","arena-toolbar"),layout=make("div","arena-layout"),stage=make("div","arena-stage"),side=make("div","arena-side"),status=make("div","app-status"),notice=make("div","arena-notice"),controls=make("div","arena-controls"),garage=make("div","arena-garage");
  const scoreboard=make("div","arena-score"),scoreTitle=make("strong","","Match announcer — final Rive pending"),scoreLine=make("div","arena-score-output",""),detail=make("div",""),healthLine=make("div","");
  scoreboard.append(scoreTitle,scoreLine,detail,healthLine);notice.hidden=true;notice.setAttribute("role","status");status.setAttribute("role","status");
  const start=textButton("Start",()=>togglePlay()),newMatchButton=textButton("New match",()=>newMatch()),restart=textButton("Restart",()=>restartMatch()),nextCup=textButton("Next cup round",()=>nextRound()),saveMatchButton=textButton("Save match",()=>saveMatch()),saveCupButton=textButton("Save cup progress",()=>saveCup()),open=textButton("Open from My files",()=>openSaved());
  const mode=document.createElement("select"),preset=document.createElement("select"),opponent=document.createElement("select");
  mode.setAttribute("aria-label","Match mode");mode.append(new Option("Practice dummy","practice"),new Option("Three-round cup","cup"));
  preset.setAttribute("aria-label","Robot preset");for(const [value,item] of Object.entries(ROBOT_PRESETS))preset.append(new Option(item.name,value));
  opponent.setAttribute("aria-label","Opponent");OPPONENTS.forEach((item,index)=>opponent.append(new Option(item.name,String(index))));
  garage.append(mode,preset,opponent);mode.addEventListener("change",syncGarage);
  const settings=document.createElement("details"),settingsSummary=make("summary","","Settings"),soundLabel=make("label","","Sound effects "),sound=document.createElement("input"),volume=document.createElement("input"),contrast=document.createElement("select"),reduced=document.createElement("input"),settingsNotice=make("span","app-status","");
  sound.type="checkbox";sound.setAttribute("aria-label","Sound effects");volume.type="range";volume.min="0";volume.max="100";volume.value="30";volume.disabled=true;volume.setAttribute("aria-label","Sound volume");
  contrast.setAttribute("aria-label","Arena contrast");contrast.append(new Option("Standard","standard"),new Option("High contrast","high"));reduced.type="checkbox";reduced.setAttribute("aria-label","Reduced motion");soundLabel.prepend(sound);
  const reducedLabel=make("label","","Reduced motion ");reducedLabel.append(reduced);settings.append(settingsSummary,contrast,reducedLabel,soundLabel,volume,settingsNotice);
  const saveLocation=document.createElement("details"),saveSummary=make("summary","","Save location"),saveFields=make("div","arena-save-fields"),
    path=appInput("Tabletop Bot Arena save path",host.w.launchContext?.path||"/Tabletop Bot Arena.game.json"),cupPath=appInput("Cup progress save path","/Tabletop Bot Arena cup.game.json"),
    chooseMatchFolder=textButton("Choose match folder",()=>chooseFolder(path,"Tabletop Bot Arena.game.json")),
    chooseCupFolder=textButton("Choose cup folder",()=>chooseFolder(cupPath,"Tabletop Bot Arena cup.game.json"));
  saveFields.append(path,chooseMatchFolder,cupPath,chooseCupFolder);saveLocation.append(saveSummary,saveFields);
  const help=document.createElement("details"),helpSummary=make("summary","","How to play");
  help.append(helpSummary,make("p","","Choose a robot and opponent, then Start. Use WASD or arrows to drive and Space for the weapon. R uses self-right once. Rounds last 90 seconds; win by damage, ring-out or health comparison. Loading starts paused."));
  toolbar.append(start,newMatchButton,restart,nextCup,open,saveMatchButton,saveCupButton);
  side.append(scoreboard,notice,garage,settings,help,saveLocation,status);
  layout.append(stage,side);
  const up=textButton("Drive forward",()=>{}),down=textButton("Drive backward",()=>{}),left=textButton("Drive left",()=>{}),right=textButton("Drive right",()=>{}),weapon=textButton("Weapon",()=>firePlayer()),selfRight=textButton("Self-right",()=>rightSelf());
  for(const [button,label] of [[up,"Drive forward"],[down,"Drive backward"],[left,"Drive left"],[right,"Drive right"]] as const)button.setAttribute("aria-label",label);
  controls.append(left,up,down,right,weapon,selfRight);element.append(toolbar,layout,controls);

  let session:ArenaSession|null=null,disposed=false,frame=0,last=performance.now(),accumulator=0,busy=false,revision=0,savedPath:string|null=null,savedVersion:string|null=null,unwatch=()=>{},watchSerial=0,watchCheck=0,lastResult="playing";
  syncGarage();
  const held={forward:0,right:0},audio=new ArenaAudio(),renderer=new THREE.WebGLRenderer({antialias:true}),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-7,7,7,-7,.1,30);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));stage.append(renderer.domElement);camera.position.set(0,0,12);camera.lookAt(0,0,0);
  const arenaMaterial=new THREE.MeshStandardMaterial({color:0x213a50,roughness:.72}),rimMaterial=new THREE.MeshStandardMaterial({color:0xd6bd67,metalness:.2,roughness:.55}),playerColor=new THREE.Color(ROBOT_PRESETS.wedge.color),opponentColor=new THREE.Color(0xcf6555);
  const arena=new THREE.Mesh(new THREE.CircleGeometry(ARENA_LIMIT,64),arenaMaterial);arena.position.z=-.25;scene.add(arena);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(ARENA_LIMIT,.08,10,72),rimMaterial);rim.position.z=-.1;scene.add(rim);
  const playerMesh=robotMesh(),opponentMesh=robotMesh();scene.add(playerMesh,opponentMesh);
  const hemi=new THREE.HemisphereLight(0xffffff,0x172235,1.8),sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-4,6,8);scene.add(hemi,sun);

  const valid=()=>!disposed&&!signal.aborted&&owner===host.storage.signedInSubject();
  const tell=(message:string)=>{if(valid())status.textContent=message};
  const mark=()=>{revision++;host.w.tabletopBotArena={dirty:true}};
  const current=()=>{if(!session)throw Error("Arena is still starting.");return session};
  const setBusy=(value:boolean)=>{busy=value;if(value)clearHeld();open.disabled=value;saveMatchButton.disabled=value;saveCupButton.disabled=value;start.disabled=value;newMatchButton.disabled=value;restart.disabled=value;nextCup.disabled=value||!session||!["won","cup-win","lost"].includes(session.result)};
  function robotMesh(){const group=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(1.1,.26,.84),new THREE.MeshStandardMaterial({roughness:.45,metalness:.35})),weapon=new THREE.Mesh(new THREE.BoxGeometry(.95,.18,.5),new THREE.MeshStandardMaterial({color:0x697585,roughness:.4,metalness:.5}));weapon.position.set(0,-.6,.02);group.add(body,weapon);group.userData={body,weapon};return group}
  function syncGarage(){const practice=mode.value==="practice",locked=!!session&&!session.paused&&session.result==="playing";opponent.disabled=practice||locked;preset.disabled=locked;mode.disabled=locked}
  function sync(){
    const game=current(),view=game.robotViews(),state=game.status();
    playerMesh.position.set(view.player.x,view.player.y,.2);opponentMesh.position.set(view.opponent.x,view.opponent.y,.2);
    (playerMesh.userData.body as THREE.Mesh).material=(playerMesh.userData.body as THREE.Mesh).material as THREE.Material;((playerMesh.userData.body as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(ROBOT_PRESETS[game.preset].color);
    ((opponentMesh.userData.body as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(state.mode==="practice"?0x7d8792:0xcf6555);
    ((playerMesh.userData.weapon as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(view.player.weapon?0x7c4b00:0x000000);
    ((opponentMesh.userData.weapon as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(view.opponent.weapon?0x7c0000:0x000000);
    scoreLine.textContent=`${state.opponent} · ${state.matchSeconds}s`;
    detail.textContent=`${state.mode==="cup"?`Cup round ${state.cupRound}/3`:"Practice"} · ${ROBOT_PRESETS[state.preset].name} · ${state.personality}`;
    healthLine.textContent=`Player ${Math.round(view.player.health)} HP / ${Math.round(view.player.energy)} energy · Opponent ${Math.round(view.opponent.health)} HP`;
    start.textContent=state.paused?(state.result==="playing"?"Start / resume":"Match complete"):"Pause";start.disabled=busy||state.result!=="playing";
    nextCup.hidden=!(state.mode==="cup"&&state.result==="won");
    syncGarage();
    if(state.result!=="playing"&&lastResult!==state.result){lastResult=state.result;audio.tone(state.result==="lost"?130:520,120,"triangle");tell(state.result==="lost"?"Opponent wins this round. Restart or open a checkpoint.":state.result==="cup-win"?"You won the three-round cup!":state.result==="won"?"Round won. Continue to the next cup opponent.":"Match complete.")}
    renderer.render(scene,camera);
  }
  function modeName():MatchMode{return mode.value==="cup"?"cup":"practice"}
  function presetName():RobotPreset{return preset.value as RobotPreset}
  function resetForOptions(){
    session=new ArenaSession({preset:presetName(),mode:modeName(),opponentIndex:Number(opponent.value),seed:crypto.getRandomValues(new Uint32Array(1))[0]});
    lastResult="playing";clearWatch();savedPath=null;savedVersion=null;delete host.w.launchContext;
  }
  async function newMatch(){
    if(busy||!valid())return;
    setBusy(true);let game:ArenaSession|null=null;
    try{
      const live=current(),before=encodeMatchSave(live),atRevision=revision;
      const options={preset:presetName(),mode:modeName(),opponentIndex:Number(opponent.value)};
      live.pause();sync();
      if(live.result==="playing"&&host.w.tabletopBotArena?.dirty&&!await host.ui.confirm("Start a new match and discard current progress?",{title:"New match",confirmLabel:"Start new match",cancelLabel:"Keep match",danger:true,signal})){tell("Current match kept and paused.");return}
      if(!valid())return;
      const unchanged=()=>session===live&&revision===atRevision&&encodeMatchSave(live)===before&&options.preset===presetName()&&options.mode===modeName()&&options.opponentIndex===Number(opponent.value);
      if(!unchanged())throw Error("The match changed while confirming; try again.");
      game=new ArenaSession({...options,seed:crypto.getRandomValues(new Uint32Array(1))[0]});await game.ready;
      if(!valid())return;
      if(!unchanged())throw Error("The match changed while preparing; try again.");
      session=game;game=null;live.dispose();lastResult="playing";clearWatch();savedPath=null;savedVersion=null;delete host.w.launchContext;host.w.tabletopBotArena={dirty:false};mark();tell("Match ready. Press Start.");sync();
    }catch(error){tell("Could not start a new match: "+(error instanceof Error?error.message:"unknown error"))}
    finally{game?.dispose();setBusy(false);if(valid()&&session)sync()}
  }

  function togglePlay(){if(busy||!valid())return;try{const game=current();if(game.result!=="playing")return;if(game.paused){game.start();audio.unlock();tell("Arena running. Drive and use the bounded weapon.");mark()}else{game.pause();clearHeld();tell("Arena paused.");mark()}sync()}catch(error){tell("Arena unavailable: "+(error as Error).message)}}
  function firePlayer(){if(busy||!valid())return;try{if(current().activatePlayerWeapon()){audio.tone(220,50);mark();tell("Weapon activated.")}else tell("Weapon is cooling down or lacks energy.")}catch{}}
  function rightSelf(){if(busy||!valid())return;try{const used=current().selfRight();if(used){audio.tone(320,60,"triangle");mark();tell("Robot self-right used once.")}else tell("Self-right is not ready.")}catch{}}
  const keys=new Set<string>(),pointers=new Map<number,{key:"forward"|"right";value:number}>();
  function clearHeld(){keys.clear();pointers.clear();updateDrive()}
  function updateDrive(){
    let forward=Number(keys.has("w")||keys.has("arrowup"))-Number(keys.has("s")||keys.has("arrowdown"));
    let rightward=Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"));
    for(const pointer of pointers.values()){if(pointer.key==="forward")forward+=pointer.value;else rightward+=pointer.value}
    held.forward=Math.max(-1,Math.min(1,forward));held.right=Math.max(-1,Math.min(1,rightward));
  }
  function drive(){if(!session||session.paused||busy)return;const command:DriveCommand={forward:held.forward,right:held.right};if(Math.abs(held.forward)+Math.abs(held.right)>0)session.drivePlayer(command)}
  const holdButton=(button:HTMLButtonElement,key:"forward"|"right",value:number)=>{
    const down=(event:PointerEvent)=>{if(event.button!==0||busy||!valid()||!session||session.paused)return;event.preventDefault();button.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{key,value});updateDrive()};
    const up=(event:PointerEvent)=>{if(pointers.delete(event.pointerId))updateDrive()};
    button.addEventListener("pointerdown",down);for(const name of ["pointerup","pointercancel","lostpointercapture"])button.addEventListener(name,up as EventListener);
  };
  holdButton(up,"forward",1);holdButton(down,"forward",-1);holdButton(left,"right",-1);holdButton(right,"right",1);
  const acceptsKey=(event:KeyboardEvent)=>{const windowElement=element.closest(".window"),target=event.target;return !busy&&valid()&&(!windowElement||windowElement.classList.contains("focused"))&&!(target instanceof Element&&target.closest("input,textarea,select,[contenteditable]:not([contenteditable=false])"))};
  const keyDown=(event:KeyboardEvent)=>{if(!acceptsKey(event))return;const key=event.key.toLowerCase();if(!["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," ","r","escape"].includes(key))return;event.preventDefault();if(event.repeat)return;if(key===" "){firePlayer();return}if(key==="r"){rightSelf();return}if(key==="escape"){togglePlay();return}if(!session||session.paused)return;keys.add(key);updateDrive()};
  const keyUp=(event:KeyboardEvent)=>{keys.delete(event.key.toLowerCase());updateDrive()};
  window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);
  weapon.addEventListener("click",firePlayer);selfRight.addEventListener("click",rightSelf);

  function clearWatch(){watchSerial++;watchCheck++;unwatch();unwatch=()=>{};notice.hidden=true;notice.textContent=""}
  function watch(context:Awaited<ReturnType<Host["storage"]["mirrorFileContext"]>>,target:string,version:string){clearWatch();const serial=watchSerial;const check=async()=>{const id=++watchCheck;if(!valid()||!context.valid()||savedPath!==target||savedVersion!==version)return;let message="";try{const file=context.files.stat?await context.files.stat(target):await context.files.read(target);message=file.status==="conflict"?"This save has conflicting copies. Resolve them in Files.":file.version!==version?"The saved match changed. Your current arena remains open.":""}catch{message="The saved match is unavailable. Your current arena remains open."}if(valid()&&context.valid()&&serial===watchSerial&&id===watchCheck){notice.textContent=message;notice.hidden=!message}};unwatch=context.files.subscribe?.(check)||(()=>{});queueMicrotask(check)}
  async function chooseFolder(input:HTMLInputElement,name:string){try{const dir=await host.storage.pickFolder({signal});if(dir===null||!valid())return;const context=await host.storage.mirrorFileContext();if(!valid()||!context.valid())return;input.value=context.path((dir==="/"?"":dir)+"/"+context.name(input.value.split("/").pop()||name))}catch(error){tell("Could not choose folder: "+(error as Error).message)}}
  async function writeDocument(kind:"match"|"cup"){
    if(!valid()||busy)return;setBusy(true);const previousDirty=!!host.w.tabletopBotArena?.dirty,atRevision=revision;let committed=false;host.w.tabletopBotArena={dirty:true};
    try{const game=current();game.pause();sync();const requested=kind==="match"?path.value:cupPath.value,text=kind==="match"?encodeMatchSave(game):encodeCupSave(game),context=await host.storage.mirrorFileContext(),target=context.path(requested);if(!target.toLowerCase().endsWith(".game.json"))throw Error("Use a .game.json name.");let expected:string|null=null;try{const old=context.files.stat?await context.files.stat(target):await context.files.read(target);if(old.status==="conflict")throw Error("Resolve the conflict in Files first.");if(target===savedPath&&savedVersion){if(old.version!==savedVersion)throw Error("The saved file changed. Save a copy or reopen it.")}else if(!await host.ui.confirm("Replace "+target+"?",{title:"Replace saved game",confirmLabel:"Replace",cancelLabel:"Cancel",danger:true,signal})){tell("Save cancelled.");return}expected=old.version}catch(error){if((error as Error).message!=="File not found.")throw error;if(target===savedPath&&savedVersion)throw Error("The saved file was removed.")}
      if(!valid()||!context.valid())return;const result=await context.files.write(target,new TextEncoder().encode(text),expected);if(!valid()||!context.valid())return;savedPath=target;savedVersion=result.version;if(host.w){host.w.launchContext={version:1,storage:"mirror",path:target,owner};host.w.title=target.split("/").pop()+" — Tabletop Bot Arena"}host.w.tabletopBotArena={dirty:revision!==atRevision};committed=true;watch(context,target,result.version);tell(result.status==="conflict"?"Saved with a conflict. Resolve it in Files.":`${kind==="match"?"Match":"Cup progress"} saved on this device; syncing with the server.`);sync()
    }catch(error){tell("Could not save: "+(error as Error).message)}finally{if(!committed&&valid()&&revision===atRevision)host.w.tabletopBotArena={dirty:previousDirty};setBusy(false)}
  }
  const saveMatch=()=>writeDocument("match"),saveCup=()=>writeDocument("cup");
  async function openSaved(selected?:string){
    if(!valid()||busy)return;setBusy(true);let replacement:ArenaSession|null=null;
    try{const live=current(),before=encodeMatchSave(live),atRevision=revision;live.pause();if(host.w.tabletopBotArena?.dirty&&!await host.ui.confirm("Open a saved arena and discard current progress?",{title:"Unsaved arena",confirmLabel:"Discard progress",cancelLabel:"Keep arena",danger:true,signal})){tell("Arena paused. Current match kept.");return}if(!valid())return;if(revision!==atRevision||encodeMatchSave(live)!==before)throw Error("The arena changed while confirming; try again.");const choice=selected||await host.storage.pickFile({extensions:[".json"],signal});if(!choice||!valid())return;const context=await host.storage.mirrorFileContext(),target=context.path(choice),file=await context.files.read(target);if(!valid()||!context.valid())return;if(file.status==="conflict")throw Error("Resolve the conflict in Files first.");if(file.data.byteLength>32*1024*1024)throw Error("Save file is too large.");const decoded=decodeSave(new TextDecoder("utf-8",{fatal:true}).decode(file.data));replacement=decoded.kind==="match-snapshot"?new ArenaSession({snapshot:decoded.payload}):new ArenaSession({preset:decoded.payload.preset,mode:decoded.payload.mode,opponentIndex:decoded.payload.opponentIndex,cupWins:decoded.payload.cupWins,cupRound:decoded.payload.cupRound,seed:crypto.getRandomValues(new Uint32Array(1))[0]});await replacement.ready;if(!valid()||!context.valid())return;if(session!==live||revision!==atRevision||encodeMatchSave(live)!==before)throw Error("The arena changed while opening; try again.");const previous=session;session=replacement;replacement=null;previous?.dispose();revision++;savedPath=target;savedVersion=file.version;path.value=target;mode.value=session.mode;preset.value=session.preset;opponent.value=String(session.opponentIndex);host.w.launchContext={version:1,storage:"mirror",path:target,owner};host.w.title=target.split("/").pop()+" — Tabletop Bot Arena";host.w.tabletopBotArena={dirty:false};lastResult=session.result;watch(context,target,file.version);tell(decoded.kind==="match-snapshot"?"Match loaded and paused. Press Start / resume.":"Cup progress loaded. New round is paused.");sync()
    }catch(error){tell("Could not open arena: "+(error as Error).message)}finally{replacement?.dispose();setBusy(false)}
  }
  const restartMatch=()=>{if(busy||!valid())return;try{const game=current();game.restart();lastResult="playing";clearHeld();mark();tell("Match restarted. Press Start.");sync()}catch(error){tell("Could not restart: "+(error as Error).message)}};
  const nextRound=()=>{if(busy||!valid())return;try{const game=current();if(!game.advanceCup())return;mark();lastResult="playing";tell("Next cup round ready. Press Start.");sync()}catch(error){tell("Could not advance cup: "+(error as Error).message)}};
  sound.addEventListener("change",()=>{audio.setMuted(!sound.checked);volume.disabled=!sound.checked;settingsNotice.textContent="";if(sound.checked)audio.unlock()});volume.addEventListener("input",()=>audio.setVolume(Number(volume.value)/100));
  const suspend=()=>{clearHeld();const game=session;if(!game||game.paused||disposed)return;game.pause();mark();sync();tell("Arena paused when its window lost attention. Press Start / resume.")};const visibility=()=>{if(document.hidden)suspend()};window.addEventListener("blur",suspend);document.addEventListener("visibilitychange",visibility);
  let observedWindow:HTMLElement|null=null;const windowObserver=new MutationObserver(()=>{if(observedWindow&&(observedWindow.hidden||!observedWindow.classList.contains("focused")||observedWindow.classList.contains("rolled")))suspend()});
  const watchWindow=()=>{const target=element.closest<HTMLElement>(".window");if(target!==observedWindow){windowObserver.disconnect();observedWindow=target;if(target)windowObserver.observe(target,{attributes:true,attributeFilter:["class","hidden"]})}if(target&&(target.hidden||!target.classList.contains("focused")||target.classList.contains("rolled")))suspend()};
  const resize=()=>{const width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight),ratio=width/height;renderer.setSize(width,height,false);camera.left=-7*ratio;camera.right=7*ratio;camera.top=7;camera.bottom=-7;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(stage);resize();
  try{session=new ArenaSession({preset:presetName(),mode:modeName(),opponentIndex:Number(opponent.value),seed:crypto.getRandomValues(new Uint32Array(1))[0]});await session.ready;if(!valid())throw Error("Window closed during startup.");syncGarage();if(host.w.launchContext?.storage==="mirror"&&host.w.launchContext.owner===owner)await openSaved(host.w.launchContext.path);else tell("Match ready. Press Start.");sync()}catch(error){tell("Could not start arena: "+(error as Error).message);throw error}
  const loop=(now:number)=>{if(disposed)return;watchWindow();const game=session;if(game){const delta=Math.min(100,now-last);last=now;accumulator+=delta;let steps=0;while(accumulator>=TICK_MS&&steps++<6){drive();game.step();accumulator-=TICK_MS}if(accumulator>TICK_MS*6)accumulator=0;sync()}frame=requestAnimationFrame(loop)};last=performance.now();frame=requestAnimationFrame(loop);
  return{element,dispose(){if(disposed)return;disposed=true;clearWatch();cancelAnimationFrame(frame);windowObserver.disconnect();observer.disconnect();window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);window.removeEventListener("blur",suspend);document.removeEventListener("visibilitychange",visibility);session?.dispose();session=null;audio.dispose();for(const group of [playerMesh,opponentMesh]){for(const child of group.children){const mesh=child as THREE.Mesh;mesh.geometry.dispose();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const material of materials)material.dispose()}}arena.geometry.dispose();arenaMaterial.dispose();rim.geometry.dispose();rimMaterial.dispose();renderer.dispose();renderer.domElement.remove()}};
}
