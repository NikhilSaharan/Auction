import { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { Gavel } from 'lucide-react';
import { formatIndianCurrency } from '../utils/format';

import { API_BASE, HUB_URL } from '../config';

const CATEGORIES = ['Marquee', 'Elite', 'Batsman', 'Bowler', 'Keeper', 'Allrounder'];

export default function BidderPortal() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('auction_bidder_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [team, setTeam] = useState(() => {
    const saved = localStorage.getItem('auction_bidder_team');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: email, Password: password })
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem('auction_bidder_user', JSON.stringify(userData));
        fetchTeam(userData.id);
      } else {
        alert('Invalid credentials');
      }
    } catch (e) {
      alert('Login error');
    }
  };

  const fetchTeam = async (ownerId) => {
    const res = await fetch(`${API_BASE}/franchisees/by-owner/${ownerId}`);
    if (res.ok) {
      const teamData = await res.json();
      setTeam(teamData);
      localStorage.setItem('auction_bidder_team', JSON.stringify(teamData));
    } else {
      alert('No team assigned to this bidder yet. Please ask the Admin to create a team for you.');
    }
  };

  if (!user || !team) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl animate-fade-in">
        <h2 className="text-2xl font-bold text-center mb-6 text-blue-400">Bidder Login</h2>
        <form onSubmit={login} className="space-y-4">
          <input type="text" placeholder="Username" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white" />
          <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white" />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-xl text-white font-medium">Login</button>
        </form>
      </div>
    );
  }

  return <LiveAuctionDashboard user={user} team={team} onRefreshTeam={() => fetchTeam(user.id)} />;
}

function LiveAuctionDashboard({ user, team, onRefreshTeam }) {
  const [connection, setConnection] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [highestBid, setHighestBid] = useState({ amount: 0, teamName: '', teamId: null });
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  
  // Real-time announcement overlay state
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  
  // Real-time lists state
  const [players, setPlayers] = useState([]);
  const [franchisees, setFranchisees] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Marquee');

  const fetchAuctionData = async () => {
    try {
      const pRes = await fetch(`${API_BASE}/players`);
      if (pRes.ok) setPlayers(await pRes.json());
      
      const fRes = await fetch(`${API_BASE}/franchisees`);
      if (fRes.ok) setFranchisees(await fRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAuctionData();

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();

    newConnection.start().catch(err => console.error('Connection failed: ', err));

    newConnection.on('ReceiveStartPlayer', (id, name, base) => {
      setActivePlayer({ id, name, base_price: base });
      setHighestBid({ amount: base, teamName: 'Base Price', teamId: null });
      setIsPaused(false);
      fetchAuctionData(); // Refresh list to show active player status
    });

    newConnection.on('ReceiveBid', (franchiseeId, franchiseeName, amount) => {
      setHighestBid({ amount, teamName: franchiseeName, teamId: franchiseeId });
    });

    newConnection.on('ReceivePauseBid', () => setIsPaused(true));
    newConnection.on('ReceiveResumeBid', () => setIsPaused(false));

    newConnection.on('ReceiveSold', (playerId, playerName, franchiseeId, fName, amount) => {
      setAnnouncement({ type: 'Sold', playerName, teamName: fName, price: amount });
      setActivePlayer(null);
      if (franchiseeId === team.id) onRefreshTeam(); // Update balance
      fetchAuctionData(); // Refresh list to show sold player
      
      // Auto-clear announcement after 4 seconds
      setTimeout(() => setAnnouncement(null), 4000);
    });

    newConnection.on('ReceiveUnsold', (playerId, playerName) => {
      setAnnouncement({ type: 'Unsold', playerName });
      setActivePlayer(null);
      fetchAuctionData(); // Refresh list to show unsold player

      // Auto-clear announcement after 4 seconds
      setTimeout(() => setAnnouncement(null), 4000);
    });

    setConnection(newConnection);
    return () => { 
      newConnection.stop(); 
    };
  }, [team.id]);



  const placeBid = async (increment) => {
    if (isPaused) return alert('Bidding is paused!');
    const newBid = highestBid.amount + increment;
    if (newBid > team.balance) return alert('Insufficient Purse Balance!');
    
    if (connection) {
      await connection.invoke('PlaceBid', team.id, team.name, newBid);
    }
  };

  // Filter lists
  const myPlayers = players.filter(p => p.sold_to === team.id && p.status === 'Sold');
  const filteredPool = players.filter(p => p.category === selectedCategory && p.status !== 'Sold');

  const [showListsOnMobile, setShowListsOnMobile] = useState(false);

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 animate-fade-in pb-12 px-4 md:px-0">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-800/80 p-5 md:p-6 rounded-2xl border border-gray-700/50 backdrop-blur-md space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-blue-400">{team.name}</h2>
          <p className="text-gray-400 text-sm">Owner: {user.email}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs md:text-sm text-gray-400 uppercase tracking-wide">Purse Balance</p>
          <p className="text-2xl md:text-3xl font-extrabold text-green-400">{formatIndianCurrency(team.balance)}</p>
        </div>
      </div>

      {/* Mobile Lists Toggle */}
      <div className="md:hidden">
        <button 
          onClick={() => setShowListsOnMobile(!showListsOnMobile)}
          className="w-full bg-gray-800/80 border border-gray-700 p-4 rounded-2xl flex justify-between items-center text-white font-semibold transition"
        >
          <span>{showListsOnMobile ? 'Hide' : 'View'} Player Lists</span>
          <span className="text-gray-400">{showListsOnMobile ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Real-time Lists Section */}
      <div className={`${showListsOnMobile ? 'grid' : 'hidden'} md:grid md:grid-cols-2 gap-4 md:gap-6`}>
        {/* Left Column: My Purchased Players */}
        <div className="bg-gray-800/50 p-5 md:p-6 rounded-2xl border border-gray-700/50 backdrop-blur-md flex flex-col shadow-xl">
          <h3 className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-4">
            My Purchased Players ({myPlayers.length})
          </h3>
          <div className="flex-1 max-h-72 md:max-h-96 overflow-y-auto pr-1 space-y-2">
            {myPlayers.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-gray-900/40 rounded-xl border border-gray-800">
                <div>
                  <p className="font-semibold text-gray-200 text-sm md:text-base">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.category}</p>
                </div>
                <span className="font-bold text-emerald-400 text-sm md:text-base">{formatIndianCurrency(p.final_price)}</span>
              </div>
            ))}
            {myPlayers.length === 0 && (
              <div className="text-gray-500 text-sm italic text-center py-12 md:py-16">No players purchased yet.</div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800 flex flex-col sm:flex-row justify-between text-xs md:text-sm text-gray-400 font-medium space-y-2 sm:space-y-0">
            <span>Spent: {formatIndianCurrency(myPlayers.reduce((sum, p) => sum + (p.final_price || 0), 0))}</span>
            <span>Purse: {formatIndianCurrency(team.balance)}</span>
          </div>
        </div>

        {/* Right Column: Complete Auction Pool */}
        <div className="bg-gray-800/50 p-5 md:p-6 rounded-2xl border border-gray-700/50 backdrop-blur-md flex flex-col shadow-xl">
          <h3 className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-4">
            Auction Pool
          </h3>
          
          {/* Category Tabs */}
          <div className="flex space-x-1.5 overflow-x-auto pb-3 mb-3 border-b border-gray-800 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                  selectedCategory === cat ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20' : 'bg-gray-950/60 text-gray-400 hover:bg-gray-800'
                }`}>
                {cat}
              </button>
            ))}
          </div>

          <div className="flex-1 max-h-72 md:max-h-96 overflow-y-auto pr-1 space-y-2">
            {filteredPool.map(p => {
              const boughtBy = franchisees.find(f => f.id === p.sold_to);
              return (
                <div key={p.id} className="flex justify-between items-center p-3 bg-gray-900/40 rounded-xl border border-gray-800 text-sm">
                  <div>
                    <p className="font-semibold text-gray-200 text-sm md:text-base">{p.name}</p>
                    <p className="text-xs text-gray-500">Base: {formatIndianCurrency(p.base_price)}</p>
                  </div>
                  <div>
                    {p.status === 'Available' && (
                      <span className="text-xs px-2.5 py-1 bg-green-500/10 text-green-400 rounded-full font-semibold border border-green-500/20">Available</span>
                    )}
                    {p.status === 'Unsold' && (
                      <span className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 rounded-full font-semibold border border-red-500/20">Unsold</span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredPool.length === 0 && (
              <div className="text-gray-500 text-sm italic text-center py-12 md:py-16">No players in this category.</div>
            )}
          </div>
        </div>
      </div>

      {/* Live Auction Section */}
      {!activePlayer ? (
        <div className="bg-gray-800/30 p-8 md:p-12 rounded-2xl text-center border border-gray-700/30 border-dashed">
          <p className="text-lg md:text-xl text-gray-500">Waiting for Curator to start the next player...</p>
        </div>
      ) : (
        <div className="bg-gray-800/80 p-5 md:p-8 rounded-2xl border border-blue-500/30 shadow-2xl shadow-blue-900/20 text-center relative overflow-hidden">

          <h3 className="text-3xl md:text-5xl font-extrabold text-white mb-1 md:mb-2">{activePlayer.name}</h3>
          <p className="text-sm md:text-base text-gray-400 mb-6 md:mb-8">Base Price: {formatIndianCurrency(activePlayer.base_price)}</p>
          
          <div className="flex flex-col justify-center items-center mb-8 md:mb-10 bg-gray-900/40 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none">
            <div className="text-center">
              <p className="text-xs md:text-sm text-gray-400 uppercase tracking-widest mb-1">Current Bid</p>
              <p className="text-3xl md:text-4xl font-bold text-green-400">{formatIndianCurrency(highestBid.amount)}</p>
              <p className="text-xs md:text-sm text-gray-500 mt-1">by {highestBid.teamName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <BidButton amount={2000000} label="+ 20L" onClick={() => placeBid(2000000)} disabled={isPaused || highestBid.teamId === team.id} />
            <BidButton amount={5000000} label="+ 50L" onClick={() => placeBid(5000000)} disabled={isPaused || highestBid.teamId === team.id} />
            <BidButton amount={10000000} label="+ 1Cr" onClick={() => placeBid(10000000)} disabled={isPaused || highestBid.teamId === team.id} />
            <BidButton amount={50000000} label="+ 5Cr" onClick={() => placeBid(50000000)} disabled={isPaused || highestBid.teamId === team.id} />
          </div>
        </div>
      )}



      {announcement && (
        <div className="fixed inset-0 bg-gray-950/85 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-gray-900 border-2 border-gray-800 p-10 rounded-3xl text-center space-y-6 max-w-lg shadow-2xl animate-bounce-in">
            <div className="flex justify-center">
              <Gavel 
                size={80} 
                className={`animate-hammer ${announcement.type === 'Sold' ? 'text-green-500' : 'text-red-500'}`} 
              />
            </div>
            
            <div className="space-y-2">
              <h2 className={`text-5xl font-extrabold tracking-wider ${announcement.type === 'Sold' ? 'text-green-400' : 'text-red-500'}`}>
                {announcement.type === 'Sold' ? 'SOLD!' : 'UNSOLD'}
              </h2>
              <p className="text-3xl font-bold text-white pt-2">{announcement.playerName}</p>
              
              {announcement.type === 'Sold' && (
                <p className="text-gray-300 text-xl pt-2">
                  to <strong className="text-purple-400 text-2xl">{announcement.teamName}</strong> for 
                  <span className="text-emerald-400 font-extrabold block text-3xl mt-1.5">{formatIndianCurrency(announcement.price)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BidButton({ label, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="bg-gray-700 hover:bg-gray-600 active:scale-95 active:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:hover:bg-gray-700 disabled:active:scale-100 disabled:active:bg-gray-700 py-4 rounded-xl font-bold text-xl text-white transition-all shadow-lg border border-gray-600 duration-100">
      {label}
    </button>
  );
}
