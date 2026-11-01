export class ArenaAudio {
  private context:AudioContext|null=null;
  private muted=true;
  private volume=.3;
  setMuted(value:boolean){this.muted=value;if(value)void this.context?.suspend();else void this.context?.resume();}
  setVolume(value:number){this.volume=Math.max(0,Math.min(1,value));}
  unlock(){if(this.muted)return;const Audio=globalThis.AudioContext;if(!Audio)return;this.context??=new Audio();void this.context.resume();}
  tone(frequency:number,duration=55,type:OscillatorType="square"){
    if(this.muted)return;this.unlock();const context=this.context;if(!context)return;
    const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,now);
    gain.gain.setValueAtTime(Math.max(.001,this.volume*.12),now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration/1000);
    oscillator.connect(gain).connect(context.destination);oscillator.start(now);oscillator.stop(now+duration/1000);
  }
  dispose(){const context=this.context;this.context=null;if(context)void context.close().catch(()=>{});}
}
