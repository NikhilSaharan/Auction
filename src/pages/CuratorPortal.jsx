import { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { Gavel } from 'lucide-react';
import { formatIndianCurrency } from '../utils/format';

import { API_BASE, HUB_URL } from '../config';

const CATEGORIES = ['Marquee', 'Elite', 'Batsman', 'Bowler', 'Keeper', 'Allrounder'];

export default function CuratorPortal() {
  const [connection, setConnection] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activePlayer, setActivePlayer] = useState(null);
  const [teams, setTeams] = useState([]);
  const [highestBid, setHighestBid] = useState({ amount: 0, teamId: null, teamName: '' });

  const [announcement, setAnnouncement] = useState(null);

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    fetchTeams();

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();

    newConnection.start().catch(err => console.error('Connection failed: ', err));

    newConnection.on('ReceiveBid', (franchiseeId, franchiseeName, amount) => {
      setHighestBid({ amount, teamId: franchiseeId, teamName: franchiseeName });
    });

    newConnection.on('ReceivePauseBid', () => setIsPaused(true));
    newConnection.on('ReceiveResumeBid', () => setIsPaused(false));

    setConnection(newConnection);

    return () => {
      newConnection.stop();
    };
  }, []);



  const fetchTeams = async () => {
    try {
      const res = await fetch(`${API_BASE}/franchisees`);
      if (res.ok) setTeams(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadCategory = async (cat) => {
    setSelectedCategory(cat);
    try {
      const res = await fetch(`${API_BASE}/players/category/${cat}`);
      if (res.ok) setPlayers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const startList = async () => {
    try {
      await fetch(`${API_BASE}/players/reset-unsold/${selectedCategory}`, {
        method: 'POST'
      });
    } catch (e) {
      console.error("Error resetting unsold players:", e);
    }

    let updated = [];
    try {
      const res = await fetch(`${API_BASE}/players/category/${selectedCategory}`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
        updated = data;
      }
    } catch (e) {
      console.error(e);
    }

    const available = updated.filter(p => p.status === 'Available');
    if (available.length === 0) {
      alert('This list is completed!');
      return;
    }
    const randomPlayer = available[Math.floor(Math.random() * available.length)];
    setActivePlayer(randomPlayer);
    setHighestBid({ amount: randomPlayer.base_price, teamId: null, teamName: 'Base Price' });
    setIsPaused(false);

    if (connection) {
      await connection.invoke('StartPlayer', randomPlayer.id, randomPlayer.name, randomPlayer.base_price);
    }
  };

  const loadNextPlayerAfterDelay = async () => {
    setActivePlayer(null);
    const currentCat = selectedCategory;
    let updatedPlayers = [];
    
    // 1. Reload current list to show status update
    try {
      const res = await fetch(`${API_BASE}/players/category/${currentCat}`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
        updatedPlayers = data;
      }
    } catch (e) {
      console.error(e);
    }

    // 2. Wait 3 seconds, then start the next player automatically
    setTimeout(async () => {
      const available = updatedPlayers.filter(p => p.status === 'Available');
      if (available.length > 0) {
        const randomPlayer = available[Math.floor(Math.random() * available.length)];
        setActivePlayer(randomPlayer);
        setHighestBid({ amount: randomPlayer.base_price, teamId: null, teamName: 'Base Price' });
        setIsPaused(false);

        if (connection) {
          await connection.invoke('StartPlayer', randomPlayer.id, randomPlayer.name, randomPlayer.base_price);
        }
      } else {
        alert('All players in this category have been auctioned!');
      }
    }, 3000);
  };

  const markSold = async () => {
    if (!highestBid.teamId) return alert('No bids yet!');
    try {
      const pName = activePlayer.name;
      const tName = highestBid.teamName;
      const amt = highestBid.amount;
      
      await fetch(`${API_BASE}/players/sold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ PlayerId: activePlayer.id, FranchiseeId: highestBid.teamId, FinalPrice: highestBid.amount })
      });
      
      setAnnouncement({ type: 'Sold', playerName: pName, teamName: tName, price: amt });
      setTimeout(() => setAnnouncement(null), 4000);

      if (connection) {
        await connection.invoke('Sold', activePlayer.id, highestBid.teamId, highestBid.teamName, highestBid.amount);
      }
      await loadNextPlayerAfterDelay();
    } catch (e) {
      console.error(e);
    }
  };

  const markUnsold = async () => {
    try {
      const pName = activePlayer.name;
      
      await fetch(`${API_BASE}/players/${activePlayer.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Status: 'Unsold', SoldTo: null, FinalPrice: null })
      });
      
      setAnnouncement({ type: 'Unsold', playerName: pName });
      setTimeout(() => setAnnouncement(null), 4000);

      if (connection) {
        await connection.invoke('Unsold', activePlayer.id);
      }
      await loadNextPlayerAfterDelay();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetAuction = async () => {
    if (!window.confirm("WARNING: Are you sure you want to reset the auction? This will permanently delete all teams (franchisees), bidder accounts, bids, and reset all player statuses to 'Available'.")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/players/reset-auction`, {
        method: 'POST'
      });
      if (res.ok) {
        alert("Auction has been reset successfully!");
        setActivePlayer(null);
        setHighestBid({ amount: 0, teamId: null, teamName: '' });
        setIsPaused(false);
        if (selectedCategory) {
          loadCategory(selectedCategory);
        } else {
          setPlayers([]);
        }
      } else {
        alert("Error resetting auction");
      }
    } catch (e) {
      console.error(e);
      alert("Error resetting auction");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">
        Curator Control Room
      </h2>

      <div className="flex space-x-4 overflow-x-auto pb-4">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => loadCategory(cat)}
            className={`px-6 py-2 rounded-full font-medium transition ${selectedCategory === cat ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-gray-800/50 p-6 rounded-2xl backdrop-blur-md border border-gray-700/50">
          <h3 className="text-xl font-semibold mb-4 text-gray-200">Player List: {selectedCategory || 'None'}</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {players.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-gray-900/50 rounded-xl border border-gray-700/50">
                <span className="font-medium text-white">{p.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'Available' ? 'bg-green-500/20 text-green-400' : p.status === 'Sold' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
          {selectedCategory && (
            <button onClick={startList} disabled={!!activePlayer} className="mt-6 w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-orange-600/20">
              Start This List
            </button>
          )}
        </div>

        {activePlayer && (
          <div className="bg-gray-800/80 p-8 rounded-2xl backdrop-blur-xl border border-orange-500/30 shadow-2xl shadow-orange-900/20 flex flex-col justify-center items-center text-center">
            <h4 className="text-sm text-orange-400 font-bold uppercase tracking-widest mb-2">Live Auction</h4>
            <h2 className="text-4xl font-extrabold text-white mb-2">{activePlayer.name}</h2>
            <p className="text-gray-400 mb-8">Base: {formatIndianCurrency(activePlayer.base_price)}</p>
            
            <div className="bg-gray-900 w-full p-6 rounded-xl border border-gray-700 mb-8 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">Highest Bid</p>
              <p className="text-3xl font-bold text-green-400">{formatIndianCurrency(highestBid.amount)}</p>
              <p className="text-gray-500 mt-2 text-xs">by {highestBid.teamName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full text-white">
              <button onClick={() => connection?.invoke('PauseBid')} disabled={isPaused} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:hover:bg-gray-700 py-3 rounded-xl font-medium transition">Pause Bid</button>
              <button onClick={() => connection?.invoke('ResumeBid')} disabled={!isPaused} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:hover:bg-gray-700 py-3 rounded-xl font-medium transition">Resume Bid</button>
              <button onClick={markSold} className="bg-green-600 hover:bg-green-500 py-3 rounded-xl font-medium transition shadow-lg shadow-green-500/20">Sold to Team</button>
              <button onClick={markUnsold} className="bg-red-600 hover:bg-red-500 py-3 rounded-xl font-medium transition shadow-lg shadow-red-500/20">Move to Unsold</button>
            </div>
          </div>
        )}
      </div>

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

      {/* Reset Auction Section */}
      <div className="pt-8 border-t border-gray-800/40 flex justify-center">
        <button 
          onClick={handleResetAuction}
          className="px-8 py-3.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 hover:text-red-300 font-semibold rounded-xl border border-red-900/30 transition shadow-lg hover:shadow-red-900/10"
        >
          Reset Auction Database & Teams
        </button>
      </div>
    </div>
  );
}
