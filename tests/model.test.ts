import {describe,expect,it} from "vitest";
import {ArenaSession,OPPONENTS,decodeSave,encodeCupSave,encodeMatchSave} from "../src/model/arena.js";

describe("Tabletop Bot Arena model",()=>{
  it("validates drive and weapon actions through the same cooldowns",async()=>{
    const game=new ArenaSession({seed:7});await game.ready;game.start();
    expect(game.drivePlayer({forward:1,right:0})).toBe(true);
    expect(game.activatePlayerWeapon()).toBe(true);
    expect(game.activatePlayerWeapon()).toBe(false);
    game.pause();
    expect(game.drivePlayer({forward:1,right:0})).toBe(false);
  });
  it("caps weapon energy and prevents resting-contact damage from repeating every tick",async()=>{
    const game=new ArenaSession({seed:9});await game.ready;game.start();
    game.placeCombatantsForTest(0,0,.7,0);
    const first=game.activatePlayerWeapon();
    game.step();
    const afterHit=game.robotViews().opponent.health;
    for(let i=0;i<20;i++)game.step();
    const afterCooldown=game.robotViews().opponent.health;
    expect(first).toBe(true);
    expect(afterHit).toBe(92);
    expect(afterCooldown).toBe(afterHit);
  });
  it("round-trips exact match snapshots and portable cup progress",async()=>{
    const game=new ArenaSession({preset:"lifter",mode:"cup",opponentIndex:1,cupWins:1,cupRound:2,seed:13});await game.ready;
    const match=decodeSave(encodeMatchSave(game));
    expect(match.kind).toBe("match-snapshot");
    if(match.kind==="match-snapshot"){
      expect(match.payload.worldSnapshot.length).toBeGreaterThan(0);
      const restored=new ArenaSession({snapshot:match.payload});await restored.ready;
      expect(restored.snapshot().player.health).toBe(match.payload.player.health);
      expect(restored.snapshot().cupWins).toBe(1);
      restored.dispose();
    }
    const cup=decodeSave(encodeCupSave(game));expect(cup.kind).toBe("cup-progress");
    if(cup.kind==="cup-progress"){expect(cup.payload.cupWins).toBe(1);expect(cup.payload.opponentIndex).toBe(1)}
  });
  it("rejects malformed and oversized state",async()=>{
    expect(()=>decodeSave("{bad")).toThrow(/JSON/);
    expect(()=>decodeSave(JSON.stringify({format:"ksu.game.save",schemaVersion:1,appId:"tabletop-bot-arena",kind:"cup-progress",contentVersion:"1",payload:{buildFingerprint:"wrong",preset:"wedge",mode:"cup",opponentIndex:0,cupWins:0,cupRound:1,paused:true}}))).toThrow();
  });
  it("defines three opponents and three cup rounds",()=>{expect(OPPONENTS).toHaveLength(3)});
});
