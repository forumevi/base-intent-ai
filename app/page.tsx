{/* SAFE PRESET BUTTONS (POPÜLER TOKEN ÇİFTLERİ) */}
<div className="space-y-2 pt-2">
  <div className="text-[11px] text-slate-400 font-bold tracking-wider">
    ⚡ POPULAR INTENT EXAMPLES (CLICK TO EXECUTE)
  </div>
  
  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
    {/* ETH -> USDC */}
    <button
      onClick={() => { 
        const p = 'Swap 0.0001 ETH for USDC';
        setPrompt(p); 
        handleRunAgent(p); 
      }}
      className="p-3 rounded-xl bg-[#010308] border border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/80 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
    >
      <span className="flex items-center gap-2">
        <span className="text-blue-400 font-bold">🔄</span>
        <span>0.0001 ETH ➔ <strong>USDC</strong></span>
      </span>
      <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">Uniswap V3</span>
    </button>

    {/* ETH -> USDT */}
    <button
      onClick={() => { 
        const p = 'Swap 0.0001 ETH for USDT';
        setPrompt(p); 
        handleRunAgent(p); 
      }}
      className="p-3 rounded-xl bg-[#010308] border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900/80 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
    >
      <span className="flex items-center gap-2">
        <span className="text-emerald-400 font-bold">🔄</span>
        <span>0.0001 ETH ➔ <strong>USDT</strong></span>
      </span>
      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">Uniswap V3</span>
    </button>

    {/* ETH -> DAI */}
    <button
      onClick={() => { 
        const p = 'Swap 0.0001 ETH for DAI';
        setPrompt(p); 
        handleRunAgent(p); 
      }}
      className="p-3 rounded-xl bg-[#010308] border border-slate-800 hover:border-amber-500/60 hover:bg-slate-900/80 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
    >
      <span className="flex items-center gap-2">
        <span className="text-amber-400 font-bold">🔄</span>
        <span>0.0001 ETH ➔ <strong>DAI</strong></span>
      </span>
      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">Uniswap V3</span>
    </button>

    {/* ETH -> AERO */}
    <button
      onClick={() => { 
        const p = 'Swap 0.0001 ETH for AERO';
        setPrompt(p); 
        handleRunAgent(p); 
      }}
      className="p-3 rounded-xl bg-[#010308] border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900/80 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
    >
      <span className="flex items-center gap-2">
        <span className="text-indigo-400 font-bold">🔄</span>
        <span>0.0001 ETH ➔ <strong>AERO</strong></span>
      </span>
      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">Aerodrome Protocol</span>
    </button>
  </div>
</div>
