// DevTools deterrent overlay.
// NOTE: this is a cosmetic deterrent only, not real protection. Anyone can
// still view source, use curl, disable JS, or read files directly before
// this triggers. All real secrets (API keys) are kept server-side already —
// this just discourages casual right-click-inspect browsing.

(function(){
  const dtBlock = document.getElementById('dtBlock');
  if(!dtBlock) return;

  let triggered = false;

  function showBlock(){
    if(triggered) return;
    triggered = true;
    dtBlock.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function hideBlock(){
    if(!triggered) return;
    triggered = false;
    dtBlock.classList.remove('show');
    document.body.style.overflow = '';
  }

  // Heuristic 1: window outer/inner size delta (DevTools docked)
  function checkSizeThreshold(){
    const threshold = 160;
    const widthDelta = window.outerWidth - window.innerWidth;
    const heightDelta = window.outerHeight - window.innerHeight;
    return widthDelta > threshold || heightDelta > threshold;
  }

  // Heuristic 2: debugger timing trap (works even when undocked)
  function checkTimingTrap(){
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const elapsed = performance.now() - start;
    return elapsed > 100;
  }

  function poll(){
    try{
      if(checkSizeThreshold() || checkTimingTrap()){
        showBlock();
      }else{
        hideBlock();
      }
    }catch(e){ /* ignore */ }
  }

  setInterval(poll, 700);

  // Also block basic right-click / common shortcuts as a light extra layer.
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    const key = e.key ? e.key.toUpperCase() : '';
    if(
      key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (key === 'I' || key === 'J' || key === 'C')) ||
      (e.ctrlKey && key === 'U')
    ){
      e.preventDefault();
    }
  });
})();
