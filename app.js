
(function(){
  let canvas = document.getElementById('canvas');
  let overlay = document.getElementById('overlay');
  let ctx = canvas ? canvas.getContext('2d') : null;
  let octx = overlay ? overlay.getContext('2d') : null;

  (function replaceCanvases(){
    const paper = document.querySelector('.paper') || document.body;

    if(canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);

  canvas = document.createElement('canvas');
  canvas.id = 'canvas';
  overlay = document.createElement('canvas');
  overlay.id = 'overlay';

  const container = document.createElement('div');
  container.className = 'canvas-replacement';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.boxSizing = 'border-box';
  container.style.margin = '0 auto';
  container.style.overflow = 'hidden';

  try{ const pr = paper && window.getComputedStyle ? window.getComputedStyle(paper).borderRadius : ''; if(pr) container.style.borderRadius = pr; }catch(e){}

  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.zIndex = '1';
  canvas.style.background = 'transparent';

  overlay.style.position = 'absolute';
  overlay.style.left = '0'; overlay.style.top = '0';
  overlay.style.width = '100%'; overlay.style.height = '100%';
  overlay.style.zIndex = '2';
  overlay.style.pointerEvents = 'none';
  overlay.style.background = 'transparent';

  container.appendChild(canvas);
  container.appendChild(overlay);
  paper.appendChild(container);
  try{ if(paper && paper.style) paper.style.overflow = 'hidden'; }catch(e){}

    ctx = canvas.getContext('2d');
    octx = overlay.getContext('2d');
  })();

  let width = 1200, height = 800;
  function resizeCanvas(w = width, h = height){

    width = w; height = h;
   
    const topBar = document.querySelector('.global-topbar');
    const leftPanel = document.querySelector('.toolbar');
    const rightPanel = document.querySelector('.sidebar-right');
    const topH = topBar ? topBar.getBoundingClientRect().height : 0;
    const leftW = leftPanel ? leftPanel.getBoundingClientRect().width + 24 : 0; 
    const rightW = rightPanel ? rightPanel.getBoundingClientRect().width + 24 : 0;
    const availableW = Math.max(300, window.innerWidth - leftW - rightW - 80);
    const availableH = Math.max(200, window.innerHeight - topH - 80);

    let displayW = Math.max(64, Math.min(width, availableW));
    let displayH = Math.max(64, Math.min(height, availableH));
    const paper = document.querySelector('.paper');
  
    const canvasArea = document.querySelector('.canvas-area');
    if(canvasArea){
      const areaRect = canvasArea.getBoundingClientRect();

      const areaInnerH = Math.max(64, Math.round(areaRect.height - 48));
      const areaInnerW = Math.max(64, Math.round(areaRect.width - 48));
      displayW = Math.min(areaInnerW, Math.min(width, availableW));
      displayH = Math.min(areaInnerH, Math.min(height, availableH));
    } else if(paper){
      const pRect = paper.getBoundingClientRect();
      const pStyle = window.getComputedStyle(paper);
      const padX = (parseFloat(pStyle.paddingLeft) || 0) + (parseFloat(pStyle.paddingRight) || 0);
      const padY = (parseFloat(pStyle.paddingTop) || 0) + (parseFloat(pStyle.paddingBottom) || 0);
      const innerW = Math.max(64, Math.round(pRect.width - padX));
      const innerH = Math.max(64, Math.round(pRect.height - padY));
      displayW = Math.min(innerW, Math.min(width, availableW));
      displayH = Math.min(innerH, Math.min(height, availableH));
    }
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    [canvas, overlay].forEach(c => {
      c.style.width = displayW + 'px';
      c.style.height = displayH + 'px';
      c.width = Math.round(displayW * dpr);
      c.height = Math.round(displayH * dpr);
    });

    const container = canvas.parentElement && canvas.parentElement.classList && canvas.parentElement.classList.contains('canvas-replacement') ? canvas.parentElement : null;
  if(container){ container.style.height = displayH + 'px'; container.style.minHeight = displayH + 'px'; }

    const sizeLabel = document.getElementById('canvasSize');
    if(sizeLabel) sizeLabel.textContent = displayW + '×' + displayH;

    layers.forEach(L=>{ L.canvas.width = canvas.width; L.canvas.height = canvas.height; });

    drawGridIfNeeded();
  }

  const state = { tool:'pencil', color:'#2aa198', size:6, opacity:1, pixelMode:false, grid:false, snap:false };

  const layers = [];
  const layersList = document.getElementById('layersList');
  const layersListLeft = document.getElementById('layersListLeft');
  const addLayerLeftBtn = document.getElementById('addLayerLeft');

  function getActiveLayer(name='Layer 1'){ if(layers.length===0) return createLayer(name); return layers[layers.length-1]; }

  function createLayer(name='Layer'){ const c = document.createElement('canvas'); c.width=canvas.width; c.height=canvas.height; c.style.position='absolute'; c.style.left='50%'; c.style.top='50%'; c.style.transform='translate(-50%,-50%)'; c.style.zIndex=1+layers.length; const layer={name,canvas:c,ctx:c.getContext('2d'),visible:true,opacity:1}; layers.push(layer); renderAllLayers(); refreshLayerUI(); return layer; }
  
  // ensure new layer canvas is added into the DOM container and placed under overlays
  function appendLayerToDOM(layer){ const container = canvas.parentElement && canvas.parentElement.classList && canvas.parentElement.classList.contains('canvas-replacement') ? canvas.parentElement : null; if(!container) return; // insert the layer canvas below the overlay and text canvas
    // find overlay and textCanvas children
    const overlayEl = container.querySelector('#overlay'); const textEl = container.querySelector('#textCanvas'); // append before overlay so layer is underneath
    if(textEl) container.insertBefore(layer.canvas, textEl); else if(overlayEl) container.insertBefore(layer.canvas, overlayEl); else container.appendChild(layer.canvas);
    // ensure canvas sizing matches
    layer.canvas.width = canvas.width; layer.canvas.height = canvas.height;
  }

  function updateLayerZIndices(){ layers.forEach((L,idx)=>{ L.canvas.style.zIndex = 1 + idx; }); }

  function refreshLayerUI(){ if(!layersList) return; layersList.innerHTML=''; layers.forEach((L,idx)=>{ const li=document.createElement('li'); li.className='layer-item'; li.innerHTML = `<div><input data-idx="${idx}" class="layer-name" value="${L.name}"></div><div class="layer-controls"><label title="visible"><input data-idx-vis="${idx}" type=checkbox ${L.visible?'checked':''}></label><button data-idx-up="${idx}">↑</button><button data-idx-down="${idx}">↓</button><button data-idx-del="${idx}">✕</button></div>`; layersList.appendChild(li); });
    layersList.querySelectorAll('.layer-name').forEach(inp=> inp.addEventListener('change', e=> layers[Number(e.target.dataset.idx)].name = e.target.value));
    layersList.querySelectorAll('[data-idx-vis]').forEach(cb=> cb.addEventListener('change', e=>{ const i = Number(e.target.dataset.idxVis); layers[i].visible = e.target.checked; renderAllLayers(); }));
    layersList.querySelectorAll('[data-idx-up]').forEach(b=> b.addEventListener('click', e=>{ const i=Number(e.target.dataset.idxUp); if(i>0){ const a=layers.splice(i,1)[0]; layers.splice(i-1,0,a); refreshLayerUI(); renderAllLayers(); }}));
    layersList.querySelectorAll('[data-idx-down]').forEach(b=> b.addEventListener('click', e=>{ const i=Number(e.target.dataset.idxDown); if(i<layers.length-1){ const a=layers.splice(i,1)[0]; layers.splice(i+1,0,a); refreshLayerUI(); renderAllLayers(); }}));
    layersList.querySelectorAll('[data-idx-del]').forEach(b=> b.addEventListener('click', e=>{ const i=Number(e.target.dataset.idxDel); if(confirm('Delete layer "'+layers[i].name+'"?')){ layers.splice(i,1); refreshLayerUI(); renderAllLayers(); }}));

    // populate left-side compact layers list if present
    if(layersListLeft){ layersListLeft.innerHTML=''; layers.forEach((L,idx)=>{ const li=document.createElement('li'); li.style.display='flex'; li.style.justifyContent='space-between'; li.style.alignItems='center'; li.style.padding='6px'; li.style.borderRadius='6px'; li.style.background='transparent'; li.innerHTML = `<span style="font-size:0.85rem">${L.name}</span><button data-idx-sel="${idx}" title="Select" style="padding:4px 6px;border-radius:6px">⋯</button>`; layersListLeft.appendChild(li); });
      layersListLeft.querySelectorAll('[data-idx-sel]').forEach(b=> b.addEventListener('click', e=>{ const i = Number(e.currentTarget.dataset.idxSel); // bring selected layer to top
        const a = layers.splice(i,1)[0]; layers.push(a); updateLayerZIndices(); refreshLayerUI(); renderAllLayers(); })); }
  }

  function renderAllLayers(targetCtx = ctx){ targetCtx.clearRect(0,0,canvas.width,canvas.height); layers.forEach((L,idx)=>{ if(!L.visible) return; targetCtx.save(); targetCtx.globalAlpha = L.opacity; targetCtx.drawImage(L.canvas,0,0); targetCtx.restore(); }); }

  const history = {stack:[], idx:-1, max:50};
  function pushHistory(){ try{ const data = ctx.getImageData(0,0,canvas.width,canvas.height); if(history.idx < history.stack.length-1) history.stack.splice(history.idx+1); history.stack.push(data); if(history.stack.length>history.max) history.stack.shift(); history.idx = history.stack.length-1; updateUndoRedoButtons(); }catch(e){console.warn('history push failed',e)} }
  function undo(){ if(history.idx>0){ history.idx--; const img = history.stack[history.idx]; ctx.putImageData(img,0,0); const L = getActiveLayer(); if(L) L.ctx.putImageData(img,0,0); renderAllLayers(); updateUndoRedoButtons(); }}
  function redo(){ if(history.idx < history.stack.length-1){ history.idx++; const img = history.stack[history.idx]; ctx.putImageData(img,0,0); const L = getActiveLayer(); if(L) L.ctx.putImageData(img,0,0); renderAllLayers(); updateUndoRedoButtons(); }}
  function updateUndoRedoButtons(){ document.getElementById('undo').disabled = history.idx<=0; document.getElementById('redo').disabled = history.idx>=history.stack.length-1; }

  let drawing=false, start=null, last=null, lastPressure=0;
  const smoothing = {enabled:true, points:[], minDistance:0.5};

  function getPointer(e){
    const el = (e.currentTarget && e.currentTarget.tagName==='CANVAS') ? e.currentTarget : canvas;
    const rect = el.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (el.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (el.height / rect.height));
    const cx = Math.max(0, Math.min(el.width - 1, x));
    const cy = Math.max(0, Math.min(el.height - 1, y));
    if(state.snap){ const step=32; return {x: Math.round(cx/step)*step, y: Math.round(cy/step)*step}; }
    return {x:cx,y:cy};
  }
  function setTool(t){ state.tool=t; document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active', b.dataset.tool===t)); updateOverlayPointerState(); const panel = document.getElementById('textToolPanel'); if(panel) panel.classList.toggle('show', t==='text'); }

  function updateOverlayPointerState(){
    const useOverlay = ['line','rect','circle'].includes(state.tool) || state.tool==='text';
    overlay.style.pointerEvents = useOverlay ? 'auto' : 'none';
  }

  function drawLineOn(lctx,a,b,opts={}){ lctx.save(); lctx.globalAlpha = opts.opacity ?? state.opacity; lctx.strokeStyle = opts.color ?? state.color; lctx.lineWidth = opts.size ?? state.size; lctx.lineCap='round'; lctx.beginPath(); lctx.moveTo(a.x,a.y); lctx.lineTo(b.x,b.y); lctx.stroke(); lctx.restore(); }
  function drawRectOn(lctx,a,b,opts={}){ lctx.save(); lctx.globalAlpha = opts.opacity ?? state.opacity; lctx.fillStyle = opts.fill ? (opts.color||state.color):'transparent'; lctx.strokeStyle = opts.color||state.color; lctx.lineWidth = opts.size||state.size; const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y), w=Math.abs(b.x-a.x), h=Math.abs(b.y-a.y); if(opts.fill) lctx.fillRect(x,y,w,h); lctx.strokeRect(x,y,w,h); lctx.restore(); }
  function drawCircleOn(lctx,a,b,opts={}){ lctx.save(); lctx.globalAlpha=opts.opacity ?? state.opacity; lctx.fillStyle = opts.fill ? (opts.color||state.color):'transparent'; lctx.strokeStyle = opts.color||state.color; lctx.lineWidth = opts.size||state.size; const rx=b.x-a.x, ry=b.y-a.y, r=Math.sqrt(rx*rx+ry*ry); lctx.beginPath(); lctx.arc(a.x,a.y,r,0,Math.PI*2); if(opts.fill) lctx.fill(); lctx.stroke(); lctx.restore(); }

  function eraseAtPoint(a,b,size){ const L = getActiveLayer(); const lctx = L.ctx; lctx.save(); lctx.globalCompositeOperation='destination-out'; lctx.lineWidth=size; lctx.lineCap='round'; lctx.beginPath(); lctx.moveTo(a.x,a.y); lctx.lineTo(b.x,b.y); lctx.stroke(); lctx.restore(); renderAllLayers(); }

  function floodFill(x,y,fillColor){ const L = getActiveLayer(); const lctx = L.ctx; const img = lctx.getImageData(0,0,canvas.width,canvas.height); const w=img.width,h=img.height,data=img.data; // guard: ignore fills that start outside the image buffer
    if(x < 0 || x >= w || y < 0 || y >= h) return; const startIdx=(y*w+x)*4; const tr=data[startIdx], tg=data[startIdx+1], tb=data[startIdx+2], ta=data[startIdx+3]; const newColor=hexToRgba(fillColor); const nr=newColor[0], ng=newColor[1], nb=newColor[2], na=Math.round(newColor[3]*255); if(tr===nr && tg===ng && tb===nb && ta===na) return; const q=new Uint32Array(w*h); let qh=0, qt=0; q[qt++]=(y<<16)|x; const seen=new Uint8Array(w*h); while(qh<qt){ const v=q[qh++]; const cx=v & 0xffff; const cy=v>>>16; const idx=cy*w+cx; if(seen[idx]) continue; seen[idx]=1; const i4=idx*4; if(data[i4]===tr && data[i4+1]===tg && data[i4+2]===tb && data[i4+3]===ta){ data[i4]=nr; data[i4+1]=ng; data[i4+2]=nb; data[i4+3]=na; if(cx+1<w) q[qt++]=(cy<<16)|(cx+1); if(cx-1>=0) q[qt++]=(cy<<16)|(cx-1); if(cy+1<h) q[qt++]=((cy+1)<<16)|cx; if(cy-1>=0) q[qt++]=((cy-1)<<16)|cx; } } lctx.putImageData(img,0,0); renderAllLayers(); }

  function hexToRgba(hex){ const c = hex.replace('#',''); const bigint = parseInt(c,16); return [(bigint>>16)&255, (bigint>>8)&255, bigint&255, 1]; }

  function drawGridIfNeeded(){ octx.clearRect(0,0,overlay.width,overlay.height); if(!state.grid) return; const step=32; octx.strokeStyle='rgba(0,0,0,0.06)'; octx.lineWidth=1; for(let x=0;x<overlay.width;x+=step){ octx.beginPath(); octx.moveTo(x,0); octx.lineTo(x,overlay.height); octx.stroke(); } for(let y=0;y<overlay.height;y+=step){ octx.beginPath(); octx.moveTo(0,y); octx.lineTo(overlay.width,y); octx.stroke(); } }

  function onPointerDown(e){ const p=getPointer(e); drawing=true; start=last=p; lastPressure = e.pressure || 0.5; if(state.tool==='fill'){ pushHistory(); floodFill(p.x,p.y,state.color); return; } if(state.tool==='pencil' || state.tool==='eraser'){ smoothing.points = [{x:p.x,y:p.y,pressure:e.pressure||0.5}]; } }

  function onPointerMove(e){ if(!drawing) return; const p=getPointer(e); if(state.tool==='pencil'){ const L = getActiveLayer(); const lctx = L.ctx; if(state.pixelMode){ drawPixel(p.x,p.y,state.color,state.size); } else { smoothing.points.push({x:p.x,y:p.y,pressure:e.pressure||0.5}); if(smoothing.points.length>1){ const a=smoothing.points[smoothing.points.length-2]; const b=smoothing.points[smoothing.points.length-1]; const size = state.size * (e.pressure || 1); drawLineOn(lctx,a,b,{color:state.color,size:size,opacity:state.opacity}); renderAllLayers(); } } } else if(state.tool==='eraser'){ eraseAtPoint(last,p,state.size); } else { octx.clearRect(0,0,overlay.width,overlay.height); octx.strokeStyle = state.color; octx.lineWidth = state.size; octx.globalAlpha = state.opacity; if(state.tool==='line'){ octx.beginPath(); octx.moveTo(start.x,start.y); octx.lineTo(p.x,p.y); octx.stroke(); } if(state.tool==='rect'){ const x=Math.min(start.x,p.x), y=Math.min(start.y,p.y), w=Math.abs(p.x-start.x), h=Math.abs(p.y-start.y); octx.strokeRect(x,y,w,h); } if(state.tool==='circle'){ const rx=p.x-start.x, ry=p.y-start.y, r=Math.sqrt(rx*rx+ry*ry); octx.beginPath(); octx.arc(start.x,start.y,r,0,Math.PI*2); octx.stroke(); } } last = p; }

  function onPointerUp(e){ if(!drawing) return; drawing=false; const p=getPointer(e); octx.clearRect(0,0,overlay.width,overlay.height); if(['line','rect','circle'].includes(state.tool)){ pushHistory(); const L = getActiveLayer(); if(state.tool==='line') drawLineOn(L.ctx,start,p,{color:state.color,size:state.size,opacity:state.opacity}); if(state.tool==='rect') drawRectOn(L.ctx,start,p,{color:state.color,size:state.size,opacity:state.opacity,fill:false}); if(state.tool==='circle') drawCircleOn(L.ctx,start,p,{color:state.color,size:state.size,opacity:state.opacity,fill:false}); renderAllLayers(); } else if(state.tool==='pencil' || state.tool==='eraser'){ smoothing.points=[]; pushHistory(); } }

  function drawPixel(x,y,color,size){ const s=Math.max(1,Math.round(size)); const L = getActiveLayer(); const lctx = L.ctx; lctx.save(); lctx.fillStyle = color; for(let i=0;i<s;i++) for(let j=0;j<s;j++) lctx.fillRect(x+i,y+j,1,1); lctx.restore(); renderAllLayers(); }

  function exportImage(type='image/png', quality=1){ const tmp=document.createElement('canvas'); tmp.width=canvas.width; tmp.height=canvas.height; const tctx=tmp.getContext('2d'); const transparent = document.getElementById('exportTransparent')?.checked; if(!transparent){ tctx.fillStyle='#ffffff'; tctx.fillRect(0,0,tmp.width,tmp.height); } layers.forEach(L=>{ if(!L.visible) return; tctx.globalAlpha = L.opacity; tctx.drawImage(L.canvas,0,0); }); const scale = Number(document.getElementById('exportScale')?.value || 1); if(scale!==1){ const scaled=document.createElement('canvas'); scaled.width=tmp.width*scale; scaled.height=tmp.height*scale; const sctx=scaled.getContext('2d'); sctx.imageSmoothingEnabled=true; sctx.drawImage(tmp,0,0,scaled.width,scaled.height); const data=scaled.toDataURL(type,quality); const a=document.createElement('a'); a.href=data; a.download='drawing.'+(type==='image/png'?'png':'jpg'); a.click(); } else { const data=tmp.toDataURL(type,quality); const a=document.createElement('a'); a.href=data; a.download='drawing.'+(type==='image/png'?'png':'jpg'); a.click(); } }

  function exportSVG(){ const tmp=document.createElement('canvas'); tmp.width=canvas.width; tmp.height=canvas.height; const tctx=tmp.getContext('2d'); layers.forEach(L=>{ if(!L.visible) return; tctx.globalAlpha=L.opacity; tctx.drawImage(L.canvas,0,0); }); const data=tmp.toDataURL('image/png'); const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='${canvas.width}' height='${canvas.height}'><image href='${data}' width='${canvas.width}' height='${canvas.height}'/></svg>`; const blob=new Blob([svg],{type:'image/svg+xml'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='drawing.svg'; a.click(); URL.revokeObjectURL(url); }

  function saveToLocal(){ try{ const data = {width:canvas.width,height:canvas.height,layers:[]}; for(const L of layers){ data.layers.push({name:L.name,visible:L.visible,opacity:L.opacity,image:L.canvas.toDataURL()}); } localStorage.setItem('drawjs_project', JSON.stringify(data)); alert('Saved project to localStorage'); }catch(e){ alert('Save failed: '+e); } }

  function loadFromLocal(){ const data = localStorage.getItem('drawjs_project'); if(!data){ alert('No saved project'); return; } const obj = JSON.parse(data); resizeCanvas(obj.width,obj.height); layers.length=0; for(const L of obj.layers){ const nl = createLayer(L.name); nl.visible = L.visible; nl.opacity = L.opacity; const img = new Image(); img.onload = ()=>{ nl.ctx.drawImage(img,0,0,canvas.width,canvas.height); renderAllLayers(); }; img.src = L.image; } pushHistory(); }

  function importImage(file){ const img=new Image(); const reader=new FileReader(); reader.onload = ()=>{ img.onload = ()=>{ const L = createLayer(file.name); L.ctx.clearRect(0,0,canvas.width,canvas.height); L.ctx.drawImage(img,0,0,canvas.width,canvas.height); // move this imported layer to bottom so drawing remains above it
    const moved = layers.pop(); layers.unshift(moved); updateLayerZIndices(); renderAllLayers(); pushHistory(); }; img.src = reader.result; }; reader.readAsDataURL(file); }

  async function saveProjectToFile(){ const data={width:canvas.width,height:canvas.height,layers:[]}; for(const L of layers){ data.layers.push({name:L.name,visible:L.visible,opacity:L.opacity,image:L.canvas.toDataURL()}); } const blob=new Blob([JSON.stringify(data)],{type:'application/json'}); if(window.showSaveFilePicker){ try{ const handle = await window.showSaveFilePicker({suggestedName:'project.draw',types:[{description:'Draw.js project',accept:{'application/json':['.draw']}}]}); const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return; }catch(e){ console.warn('save via FS API failed',e); } } const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='project.draw'; a.click(); URL.revokeObjectURL(url); }

  async function openProjectFile(file){ const txt = await file.text(); const data = JSON.parse(txt); if(data.width && data.height){ resizeCanvas(data.width,data.height); layers.length=0; for(const L of data.layers){ const nl=createLayer(L.name); nl.visible = L.visible; nl.opacity = L.opacity; const img=new Image(); img.onload = ()=>{ nl.ctx.drawImage(img,0,0,canvas.width,canvas.height); renderAllLayers(); }; img.src = L.image; } // when opening, keep layer order but ensure z-indices are correct
      updateLayerZIndices(); pushHistory(); } }

  document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click', ()=> setTool(b.dataset.tool)));
 
  updateOverlayPointerState();
  document.getElementById('color').addEventListener('input', e=> state.color=e.target.value);
  document.getElementById('size').addEventListener('input', e=> state.size=Number(e.target.value));
  document.getElementById('opacity').addEventListener('input', e=> state.opacity=Number(e.target.value));
  document.getElementById('pixelMode').addEventListener('change', e=> state.pixelMode=e.target.checked);

  const fontSelect = document.getElementById('fontSelect');
  const textSizeInput = document.getElementById('textSize');
  const uploadFontBtn = document.getElementById('uploadFontBtn');
  const uploadFontFile = document.getElementById('uploadFontFile');

  if(uploadFontBtn && uploadFontFile){
    uploadFontBtn.addEventListener('click', ()=> uploadFontFile.click());
    uploadFontFile.addEventListener('change', async e=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      const name = f.name.replace(/\.[^.]+$/, '') + '-' + Date.now();
      const data = await f.arrayBuffer();
      try{
        const font = new FontFace(name, data);
        await font.load();
        document.fonts.add(font);
        const opt = document.createElement('option'); opt.textContent = name; opt.value = name; fontSelect.appendChild(opt); fontSelect.value = name;
      }catch(err){ console.warn('font load failed',err); alert('Font failed to load'); }
    });
  }
  if(document.getElementById('textToolClose')) document.getElementById('textToolClose').addEventListener('click', ()=>{ const p=document.getElementById('textToolPanel'); if(p) p.classList.remove('show'); setTool('pencil'); });

  let textSelecting = false, textSelStart = null, textSelRect = null;
  function startTextSelection(p){ textSelecting = true; textSelStart = p; }
  function updateTextSelection(p){ if(!textSelecting) return; const x=Math.min(textSelStart.x,p.x), y=Math.min(textSelStart.y,p.y), w=Math.abs(p.x-textSelStart.x), h=Math.abs(p.y-textSelStart.y); textSelRect = {x,y,w,h}; // draw selection on overlay
    octx.clearRect(0,0,overlay.width,overlay.height); octx.save(); octx.strokeStyle='rgba(0,0,0,0.6)'; octx.setLineDash([6,4]); octx.lineWidth=1; octx.strokeRect(x,y,w,h); octx.restore(); }
  function finishTextSelection(){ textSelecting=false; octx.clearRect(0,0,overlay.width,overlay.height); if(!textSelRect) return; // create textarea positioned over selection
    const rect = overlay.getBoundingClientRect(); const ta = document.createElement('textarea'); ta.style.position='absolute'; ta.style.left = (rect.left + (textSelRect.x/canvas.width)*rect.width) + 'px'; ta.style.top = (rect.top + (textSelRect.y/canvas.height)*rect.height) + 'px'; ta.style.width = Math.max(40, (textSelRect.w/canvas.width)*rect.width) + 'px'; ta.style.height = Math.max(20, (textSelRect.h/canvas.height)*rect.height) + 'px'; ta.style.zIndex = 9999; ta.style.font = (textSizeInput?.value||24) + 'px ' + (fontSelect?.value || 'IBM Plex Mono'); ta.style.color = state.color; ta.style.background = 'transparent'; ta.style.border = '1px dashed rgba(0,0,0,0.2)'; ta.placeholder = 'Type text and blur to place'; document.body.appendChild(ta); ta.focus();
  function commit(){ const text = ta.value; document.body.removeChild(ta); if(text){ pushHistory(); const L = getActiveLayer(); L.ctx.save(); L.ctx.fillStyle = state.color; L.ctx.globalAlpha = state.opacity; const fontSize = Number(textSizeInput?.value||24); const fontFamily = fontSelect?.value || 'IBM Plex Mono'; L.ctx.font = fontSize + 'px "' + fontFamily + '"'; L.ctx.textBaseline = 'top';
        const canvasX = textSelRect.x; const canvasY = textSelRect.y; L.ctx.fillText(text, canvasX, canvasY); L.ctx.restore(); renderAllLayers(); pushHistory(); }
      textSelRect = null; }
    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); ta.blur(); } }); }

  overlay.addEventListener('pointerdown', e=>{ if(state.tool!=='text') return; const p = getPointer(e); startTextSelection(p); });
  overlay.addEventListener('pointermove', e=>{ if(state.tool!=='text') return; if(!textSelecting) return; const p = getPointer(e); updateTextSelection(p); });
  overlay.addEventListener('pointerup', e=>{ if(state.tool!=='text') return; finishTextSelection(); });

  const swatchContainer = document.getElementById('colorSwatches');
  const saveColorBtn = document.getElementById('saveColorBtn');

  const defaultSwatches = ['#000000','#ffffff','#2aa198','#e8c9f0','#ff3b30','#00ff00'];
  function loadSwatches(){ try{ const s = JSON.parse(localStorage.getItem('drawjs_swatches')||'null'); return Array.isArray(s) && s.length===6 ? s : defaultSwatches.slice(); }catch(e){return defaultSwatches.slice()} }
  function saveSwatches(arr){ try{ localStorage.setItem('drawjs_swatches', JSON.stringify(arr)); }catch(e){} }
  function renderSwatches(){ const arr = loadSwatches(); if(!swatchContainer) return; swatchContainer.querySelectorAll('.swatch').forEach(btn=>{ const idx = Number(btn.dataset.idx); btn.style.background = arr[idx] || '#fff'; }); }
  function setColorFromSwatch(e){ const btn = e.currentTarget; const idx = Number(btn.dataset.idx); const arr = loadSwatches(); const color = arr[idx] || '#000000'; const colorInput = document.getElementById('color'); colorInput.value = color; colorInput.dispatchEvent(new Event('input',{bubbles:true})); }
  if(swatchContainer){ swatchContainer.querySelectorAll('.swatch').forEach(b=> b.addEventListener('click', setColorFromSwatch)); renderSwatches(); }
  if(saveColorBtn){ saveColorBtn.addEventListener('click', ()=>{ const colorInput = document.getElementById('color'); const cur = colorInput.value; const arr = loadSwatches(); arr[0] = cur; saveSwatches(arr); renderSwatches(); }); }
  document.getElementById('gridToggle').addEventListener('change', e=>{ state.grid=e.target.checked; drawGridIfNeeded(); });
  document.getElementById('snapToggle').addEventListener('change', e=> state.snap=e.target.checked);
  const leftClearBtn = document.getElementById('clear'); if(leftClearBtn) leftClearBtn.addEventListener('click', doClear);
  const leftUndoBtn = document.getElementById('undo'); if(leftUndoBtn) leftUndoBtn.addEventListener('click', undo);
  const leftRedoBtn = document.getElementById('redo'); if(leftRedoBtn) leftRedoBtn.addEventListener('click', redo);
  document.getElementById('exportPNG').addEventListener('click', ()=> exportImage('image/png'));
  document.getElementById('exportJPG').addEventListener('click', ()=> exportImage('image/jpeg',0.92));
  document.getElementById('saveLocal').addEventListener('click', saveToLocal);
  document.getElementById('loadLocal').addEventListener('click', loadFromLocal);
  document.getElementById('importBtn').addEventListener('click', ()=> document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e=> importImage(e.target.files[0]));
  document.getElementById('exportSVG').addEventListener('click', exportSVG);
  document.getElementById('saveProjectFs').addEventListener('click', saveProjectToFile);
  document.getElementById('openProjectBtn').addEventListener('click', ()=> document.getElementById('openProjectFile').click());
  document.getElementById('openProjectFile').addEventListener('change', e=> openProjectFile(e.target.files[0]));

  const htUndo = document.getElementById('ht-undo'); if(htUndo) htUndo.addEventListener('click', undo);
  const htRedo = document.getElementById('ht-redo'); if(htRedo) htRedo.addEventListener('click', redo);
  const htSave = document.getElementById('ht-save'); if(htSave) htSave.addEventListener('click', saveToLocal);
  const htLoad = document.getElementById('ht-load'); if(htLoad) htLoad.addEventListener('click', loadFromLocal);
  const htImport = document.getElementById('ht-import'); if(htImport) htImport.addEventListener('click', ()=> document.getElementById('importFile').click());
  const htExport = document.getElementById('ht-export'); if(htExport) htExport.addEventListener('click', ()=> exportImage('image/png'));
  const htGrid = document.getElementById('ht-grid'); if(htGrid) htGrid.addEventListener('click', ()=> { state.grid = !state.grid; document.getElementById('gridToggle').checked = state.grid; drawGridIfNeeded(); });
  function doClear(){ if(confirm('Clear the canvas?')){ pushHistory(); layers.forEach(L=>L.ctx.clearRect(0,0,canvas.width,canvas.height)); renderAllLayers(); } }
  const leftClear = document.getElementById('clear'); if(leftClear) leftClear.addEventListener('click', doClear);
  const htClear = document.getElementById('ht-clear'); if(htClear) htClear.addEventListener('click', doClear);

  const addLayerBtn = document.getElementById('addLayer');
  if(addLayerBtn) addLayerBtn.addEventListener('click', ()=> { createLayer('Layer '+(layers.length+1)); });
  if(addLayerLeftBtn) addLayerLeftBtn.addEventListener('click', ()=> { createLayer('Layer '+(layers.length+1)); });

  const darkToggleSidebar = document.getElementById('darkToggle');
  if(darkToggleSidebar) darkToggleSidebar.addEventListener('change', e=> document.body.classList.toggle('dark', e.target.checked));
  const darkToggleHeader = document.getElementById('darkToggleHeader');
  if(darkToggleHeader){
    darkToggleHeader.checked = darkToggleSidebar ? darkToggleSidebar.checked : false;
    darkToggleHeader.addEventListener('change', e=>{
      document.body.classList.toggle('dark', e.target.checked);
      if(darkToggleSidebar) darkToggleSidebar.checked = e.target.checked;
    });
  }

  resizeCanvas();
  createLayer('Layer 1');
  overlay.addEventListener('pointerdown', onPointerDown);
  overlay.addEventListener('pointermove', onPointerMove);
  overlay.addEventListener('pointerup', onPointerUp);
  overlay.addEventListener('pointerleave', onPointerUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);

  window.addEventListener('keydown', e=>{

    const tgt = e.target || document.activeElement;
    if(tgt && (tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;

    if(e.ctrlKey && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); }
    if(e.ctrlKey && (e.key.toLowerCase()==='y' || (e.shiftKey && e.key.toLowerCase()==='z'))){ e.preventDefault(); redo(); }
    if(e.key.toLowerCase()==='b') setTool('pencil');
    if(e.key.toLowerCase()==='e') setTool('eraser');
    if(e.key.toLowerCase()==='g') setTool('fill');
    if(e.key.toLowerCase()==='t') setTool('text');
    if(e.key.toLowerCase()==='r') setTool('rect');
    if(e.key.toLowerCase()==='l') setTool('line');
    if(e.key.toLowerCase()==='o') setTool('circle');
  });

  pushHistory();

  window.addEventListener('resize', ()=> resizeCanvas(width,height));

  window.drawApp = {canvas, ctx, pushHistory, setTool, exportImage};
})();
