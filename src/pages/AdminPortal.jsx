import { useState, useEffect } from 'react';
import { UserPlus, ShieldPlus, List, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { formatIndianCurrency, parseIndianCurrency } from '../utils/format';

import { API_BASE } from '../config';

export default function AdminPortal() {
  const [bidders, setBidders] = useState([]);
  const [players, setPlayers] = useState([]);
  const [franchisees, setFranchisees] = useState([]);

  useEffect(() => {
    fetchBidders();
    fetchPlayers();
    fetchFranchisees();
  }, []);

  const fetchBidders = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/bidders`);
      if (res.ok) setBidders(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`${API_BASE}/players`);
      if (res.ok) setPlayers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFranchisees = async () => {
    try {
      const res = await fetch(`${API_BASE}/franchisees`);
      if (res.ok) setFranchisees(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          Admin Dashboard
        </h2>
        <button onClick={() => { fetchBidders(); fetchPlayers(); fetchFranchisees(); }} className="p-2 hover:bg-gray-800 rounded-full transition">
          <RefreshCw size={20} className="text-gray-400"/>
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <CreateBidderCard bidders={bidders} onCreated={fetchBidders} />
        <CreateFranchiseeCard bidders={bidders} franchisees={franchisees} players={players} onCreated={fetchFranchisees} />
      </div>

      <PlayerManager players={players} onRefresh={fetchPlayers} />
    </div>
  );
}

function CreateBidderCard({ bidders, onCreated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password_hash: password, role: 'Bidder' })
      });
      if (res.ok) {
        setUsername(''); setPassword('');
        onCreated();
        alert('Bidder Created!');
      } else {
        alert('Error creating bidder');
      }
    } catch (e) {
      alert('Error creating bidder');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 p-6 rounded-2xl backdrop-blur-md border border-gray-700/50 shadow-xl">
        <div className="flex items-center mb-4 space-x-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><UserPlus size={24} /></div>
          <h3 className="text-xl font-semibold">Create Bidder</h3>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input type="text" placeholder="Username" required value={username} onChange={e => setUsername(e.target.value)}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition text-white" />
          <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition text-white" />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-xl transition shadow-lg shadow-blue-500/20">
            Create
          </button>
        </form>
      </div>

      <div className="bg-gray-800/50 p-6 rounded-2xl backdrop-blur-md border border-gray-700/50 shadow-xl max-h-[350px] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4 text-gray-300">Registered Bidders ({bidders.length})</h3>
        <div className="space-y-2">
          {bidders.map(b => (
            <div key={b.id} className="flex justify-between items-center bg-gray-900/40 p-3 rounded-xl border border-gray-800">
              <div>
                <p className="font-medium text-gray-200">{b.email}</p>
                <p className="text-xs text-gray-500 font-mono">ID: {b.id}</p>
              </div>
              <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg font-medium">Bidder</span>
            </div>
          ))}
          {bidders.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No bidders created yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateFranchiseeCard({ bidders, franchisees, players, onCreated }) {
  const [ownerId, setOwnerId] = useState('');
  const [name, setName] = useState('');
  const [purse, setPurse] = useState('');
  const [purseUnit, setPurseUnit] = useState('Cr');

  // Editing state for teams
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editPurseLimit, setEditPurseLimit] = useState('');
  const [editPurseUnit, setEditPurseUnit] = useState('Cr');
  const [editBalance, setEditBalance] = useState('');
  const [editBalanceUnit, setEditBalanceUnit] = useState('Cr');
  
  // Expandable team for viewing players
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const numericPurse = parseFloat(purse);
    if (isNaN(numericPurse) || numericPurse <= 0) return alert("Invalid amount");
    const parsedPurse = purseUnit === 'Cr' ? numericPurse * 10000000 : numericPurse * 100000;
    
    try {
      const res = await fetch(`${API_BASE}/franchisees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: Number(ownerId), name, purse_limit: parsedPurse, balance: parsedPurse })
      });
      if (res.ok) {
        setOwnerId(''); setName(''); setPurse('');
        onCreated();
        alert('Franchisee Created!');
      } else {
        alert('Error creating franchisee');
      }
    } catch (e) {
      alert('Error creating franchisee');
    }
  };

  const handleUpdateTeam = async (team) => {
    const newPurseNum = parseFloat(editPurseLimit);
    const newPurse = editPurseUnit === 'Cr' ? newPurseNum * 10000000 : newPurseNum * 100000;
    
    const newBalanceNum = parseFloat(editBalance);
    const newBalance = editBalanceUnit === 'Cr' ? newBalanceNum * 10000000 : newBalanceNum * 100000;

    if (isNaN(newPurse) || newPurse <= 0 || isNaN(newBalance)) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/franchisees/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: team.name, 
          owner_id: team.owner_id,
          purse_limit: newPurse, 
          balance: newBalance 
        })
      });
      if (res.ok) {
        setEditingTeamId(null);
        onCreated();
        alert('Team updated successfully!');
      } else {
        alert('Failed to update team');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating team');
    }
  };

  const startEditTeam = (team) => {
    setEditingTeamId(team.id);
    
    const getParts = (val) => {
      if (val >= 10000000) return { v: val / 10000000, u: 'Cr' };
      return { v: val / 100000, u: 'Lakh' };
    };

    const p = getParts(team.purse_limit);
    setEditPurseLimit(p.v);
    setEditPurseUnit(p.u);

    const b = getParts(team.balance);
    setEditBalance(b.v);
    setEditBalanceUnit(b.u);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 p-6 rounded-2xl backdrop-blur-md border border-gray-700/50 shadow-xl">
        <div className="flex items-center mb-4 space-x-3">
          <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><ShieldPlus size={24} /></div>
          <h3 className="text-xl font-semibold">Create Team</h3>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <select required value={ownerId} onChange={e => setOwnerId(e.target.value)}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none transition text-gray-200">
            <option value="" disabled className="bg-gray-950">Select Owner</option>
            {bidders.filter(b => !franchisees.some(f => f.owner_id === b.id)).map(b => (
              <option key={b.id} value={b.id} className="bg-gray-950">{b.email}</option>
            ))}
          </select>
          <input type="text" placeholder="Team Name" required value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none transition text-white" />
          <div className="flex space-x-2">
            <input type="number" step="any" placeholder="Purse Limit (e.g. 100)" required value={purse} onChange={e => setPurse(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none transition text-white" />
            <select value={purseUnit} onChange={e => setPurseUnit(e.target.value)}
              className="bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none transition text-white">
              <option value="Cr" className="bg-gray-950">Cr</option>
              <option value="Lakh" className="bg-gray-950">Lakh</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 rounded-xl transition shadow-lg shadow-purple-500/20">
            Create
          </button>
        </form>
      </div>

      <div className="bg-gray-800/50 p-6 rounded-2xl backdrop-blur-md border border-gray-700/50 shadow-xl max-h-[350px] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4 text-gray-300">Registered Teams ({franchisees.length})</h3>
        <div className="space-y-3">
          {franchisees.map(f => {
            const owner = bidders.find(b => b.id === f.owner_id);
            const teamPlayers = players.filter(p => p.sold_to === f.id && p.status === 'Sold');

            return (
              <div key={f.id} className="bg-gray-900/40 p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-lg text-purple-400">{f.name}</h4>
                    <p className="text-xs text-gray-400">Owner: {owner ? owner.email : 'Unknown'}</p>
                  </div>
                  <button 
                    onClick={() => setExpandedTeamId(expandedTeamId === f.id ? null : f.id)}
                    className="text-xs px-2.5 py-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-lg transition"
                  >
                    {expandedTeamId === f.id ? 'Hide Players' : `View Players (${teamPlayers.length})`}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1 text-sm border-t border-gray-800/60">
                  <div>
                    <span className="text-xs text-gray-500 block">Purse Limit</span>
                    {editingTeamId === f.id ? (
                      <div className="flex items-center space-x-1 mt-1">
                        <input type="number" step="any" value={editPurseLimit} onChange={e => setEditPurseLimit(e.target.value)}
                          className="bg-gray-950 border border-gray-700 rounded px-2 py-0.5 w-16 text-sm text-white" />
                        <select value={editPurseUnit} onChange={e => setEditPurseUnit(e.target.value)}
                          className="bg-gray-950 border border-gray-700 rounded px-1 py-0.5 text-sm text-white">
                          <option value="Cr">Cr</option>
                          <option value="Lakh">Lakh</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="font-semibold text-gray-200">{formatIndianCurrency(f.purse_limit)}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Current Balance</span>
                    {editingTeamId === f.id ? (
                      <div className="flex items-center space-x-1 mt-1">
                        <input type="number" step="any" value={editBalance} onChange={e => setEditBalance(e.target.value)}
                          className="bg-gray-950 border border-gray-700 rounded px-2 py-0.5 w-16 text-sm text-white" />
                        <select value={editBalanceUnit} onChange={e => setEditBalanceUnit(e.target.value)}
                          className="bg-gray-950 border border-gray-700 rounded px-1 py-0.5 text-sm text-white">
                          <option value="Cr">Cr</option>
                          <option value="Lakh">Lakh</option>
                        </select>
                      </div>
                    ) : (
                      <span className="font-semibold text-emerald-400 block mt-0.5">{formatIndianCurrency(f.balance)}</span>
                    )}
                  </div>
                  <div className="col-span-2 flex justify-end space-x-3 mt-2 border-t border-gray-800/60 pt-2">
                    {editingTeamId === f.id ? (
                      <>
                        <button onClick={() => handleUpdateTeam(f)} className="text-sm px-3 py-1 bg-green-500/20 text-green-400 font-semibold rounded hover:bg-green-500/30 transition">Save Changes</button>
                        <button onClick={() => setEditingTeamId(null)} className="text-sm px-3 py-1 bg-gray-700/50 text-gray-300 rounded hover:bg-gray-700 transition">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => startEditTeam(f)} className="text-sm text-gray-400 hover:text-purple-400 flex items-center transition" title="Edit Team Limits">
                        <Edit2 size={14} className="mr-1"/> Edit Limits
                      </button>
                    )}
                  </div>
                </div>

                {expandedTeamId === f.id && (
                  <div className="mt-3 pt-3 border-t border-gray-800 space-y-2 animate-fade-in">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bought Players:</p>
                    {teamPlayers.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No players purchased yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {teamPlayers.map(p => (
                          <div key={p.id} className="flex justify-between items-center text-xs bg-gray-950/40 px-3 py-1.5 rounded border border-gray-800/50">
                            <span className="text-gray-300 font-medium">{p.name} ({p.category})</span>
                            <span className="text-emerald-400 font-semibold">{formatIndianCurrency(p.final_price)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {franchisees.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No teams created yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerManager({ players, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editPrice, setEditPrice] = useState(0);

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditCat(p.category);
    setEditPrice(p.base_price);
  };

  const saveEdit = async (id) => {
    await fetch(`${API_BASE}/players/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, category: editCat, base_price: parseIndianCurrency(editPrice) })
    });
    setEditingId(null);
    onRefresh();
  };

  const deletePlayer = async (id) => {
    if (!window.confirm("Are you sure you want to delete this player?")) return;
    await fetch(`${API_BASE}/players/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="bg-gray-800/50 p-6 rounded-2xl backdrop-blur-md border border-gray-700/50 shadow-xl">
      <div className="flex items-center mb-6 space-x-3">
        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><List size={24} /></div>
        <h3 className="text-xl font-semibold">Player Database ({players.length})</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-sm">
              <th className="pb-3 px-4">Name</th>
              <th className="pb-3 px-4">Category</th>
              <th className="pb-3 px-4">Base Price</th>
              <th className="pb-3 px-4">Status</th>
              <th className="pb-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/20 transition">
                {editingId === p.id ? (
                  <>
                    <td className="py-2 px-4"><input className="bg-gray-900 border border-gray-600 rounded px-2 py-1 w-full text-white" value={editName} onChange={e=>setEditName(e.target.value)} /></td>
                    <td className="py-2 px-4">
                      <select className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white" value={editCat} onChange={e=>setEditCat(e.target.value)}>
                        <option value="Marquee">Marquee</option>
                        <option value="Elite">Elite</option>
                        <option value="Bowler">Bowler</option>
                        <option value="Keeper">Keeper</option>
                        <option value="Allrounder">Allrounder</option>
                      </select>
                    </td>
                    <td className="py-2 px-4"><input type="text" className="bg-gray-900 border border-gray-600 rounded px-2 py-1 w-24 text-white" value={editPrice} onChange={e=>setEditPrice(e.target.value)} /></td>
                    <td className="py-2 px-4">{p.status}</td>
                    <td className="py-2 px-4 text-right space-x-2">
                      <button onClick={() => saveEdit(p.id)} className="text-green-400 hover:text-green-300">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-300">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3 px-4 font-medium text-white">{p.name}</td>
                    <td className="py-3 px-4 text-gray-300">
                      <span className={`px-2 py-1 rounded text-xs ${
                        p.category === 'Marquee' ? 'bg-purple-500/20 text-purple-400' :
                        p.category === 'Elite' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/50 text-gray-300'
                      }`}>{p.category}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{formatIndianCurrency(p.base_price)}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{p.status}</td>
                    <td className="py-3 px-4 text-right space-x-4">
                      <button onClick={() => startEdit(p)} className="text-blue-400 hover:text-blue-300 transition" title="Edit"><Edit2 size={16}/></button>
                      <button onClick={() => deletePlayer(p.id)} className="text-red-400 hover:text-red-300 transition" title="Delete"><Trash2 size={16}/></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && (
          <div className="text-center py-8 text-gray-500">No players in the database. Run the seed script.</div>
        )}
      </div>
    </div>
  );
}
