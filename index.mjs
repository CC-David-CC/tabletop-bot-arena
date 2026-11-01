import './style.css';
import {startView} from './src/view/desktop.ts';

export function mount(host){
 const {make}=host.ui,body=make('div','window-content tabletop-arena-app'),status=make('div','app-status','Loading Tabletop Bot Arena…'),controller=new AbortController();
 body.append(status);
 let disposed=false,view=null;
 queueMicrotask(()=>{
  void Promise.resolve().then(async()=>{
   if(disposed||controller.signal.aborted)return;
   const candidate=await startView(host,controller.signal);
   if(disposed){candidate.dispose();return;}
   view=candidate;body.replaceChildren(view.element);
  }).catch(error=>{if(!disposed&&body.isConnected)status.textContent='Could not start Tabletop Bot Arena: '+error.message;});
 });
 return {element:body,dispose(){if(disposed)return;disposed=true;controller.abort();view?.dispose();view=null;}};
}
