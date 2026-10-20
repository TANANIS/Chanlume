(function () {
  "use strict";
  globalThis.createChanlumeRecentFeeds = ({Core,getState,isActive,onUpdate}) => {
    const cache=new Map(), running=new Set(), force=new Set();
    let ids=[],signature="",limit=0;
    const key=id=>`${id}:${getState().channels[id]?.url}:${getState().settings.hideShorts}`;
    const get=id=>cache.get(key(id));
    const validDate=value=>{const day=String(value||"").slice(0,10),d=new Date(day+"T00:00:00Z");return /^\d{4}-\d{2}-\d{2}T/.test(value||"")&&Number.isFinite(Date.parse(value))&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;};
    const notify=()=>queueMicrotask(()=>{if(isActive())onUpdate();});
    function pump() {
      if(!isActive()||!getState().settings.enabled||document.hidden)return;
      for(const id of ids.slice(0,limit)) {
        if(running.size>=3)break;
        const stamp=key(id), previous=cache.get(stamp);
        if(running.has(stamp)||(!force.has(stamp)&&previous))continue;
        const refresh=force.delete(stamp);running.add(stamp);
        cache.set(stamp,{...previous,status:"loading"});
        Promise.resolve().then(()=>chrome.runtime.sendMessage({type:"CHANLUME_CHANNEL_FEED",channelId:id,force:refresh})).then(result=>{
          if(!getState().settings.enabled||!getState().channels[id]||key(id)!==stamp)return;
          if(!result?.ok||!Array.isArray(result.videos)||result.hideShorts!==getState().settings.hideShorts)throw Object.assign(new Error("Feed unavailable"),{code:result?.code||"PARSE"});
          const seen=new Set(),videos=[];
          for(const v of result.videos.slice(0,15)) {
            if(!/^[\w-]{11}$/.test(v.id||"")||typeof v.title!=="string"||!v.title.trim()||seen.has(v.id))continue;
            seen.add(v.id);videos.push({id:v.id,title:v.title.slice(0,500),published:validDate(v.published)?v.published:(previous?.videos?.find(old=>old.id===v.id)?.published||""),publishedLabel:String(v.publishedLabel||"").slice(0,100),duration:/^\d{1,3}(?::\d{2}){1,2}$/.test(v.duration||"")?v.duration:"",viewCountLabel:String(v.viewCountLabel||"").slice(0,100)});
          }
          cache.set(stamp,{status:"ready",videos,fetchedAt:result.fetchedAt||Date.now(),dateWarning:result.dateWarning||""});
        }).catch(error=>{
          if(getState().settings.enabled&&getState().channels[id]&&key(id)===stamp)cache.set(stamp,{...previous,status:"error",error:error.code||"NETWORK"});
        }).finally(()=>{running.delete(stamp);pump();notify();});
      }
    }
    function setScope(next) {
      const state=getState();next=[...new Set(next.map(id=>Core.resolveChannelRecordId(state,id)).filter(id=>state.channels[id]))];
      const stamp=JSON.stringify([next,state.settings.hideShorts,next.map(id=>state.channels[id].url)]);
      if(stamp!==signature){signature=stamp;ids=next;limit=ids.length<=100?ids.length:24;for(const id of ids.slice(0,limit)){const item=get(id);if(item?.status==="ready"&&Date.now()-item.fetchedAt>300000)force.add(key(id));}}
      const live=new Set(ids.map(key));for(const stamp of cache.keys())if(cache.size>100&&!live.has(stamp)&&!running.has(stamp))cache.delete(stamp);
      pump();
    }
    return {get,setScope,
      retry(id){const stamp=key(id);if(!running.has(stamp))force.add(stamp);pump();notify();},
      refresh(){for(const id of ids.slice(0,limit))if(!running.has(key(id)))force.add(key(id));pump();notify();},
      more(){limit=Math.min(ids.length,limit+24);pump();notify();},
      status(){const selected=ids.slice(0,limit),failed=selected.filter(id=>!force.has(key(id))&&get(id)?.status==="error"),done=selected.filter(id=>!force.has(key(id))&&["ready","error"].includes(get(id)?.status)).length;return{total:ids.length,limit,done,failed,pending:done<selected.length,more:ids.length>limit};},
      videos(){return ids.slice(0,limit).flatMap(id=>(get(id)?.videos||[]).map(video=>({...video,channelId:id})));}
    };
  };
})();
