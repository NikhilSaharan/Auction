import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import AdminPortal from './pages/AdminPortal';
import CuratorPortal from './pages/CuratorPortal';
import BidderPortal from './pages/BidderPortal';

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

function AppLayout() {
  const location = useLocation();
  const isBidder = location.pathname === '/bidder';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {!isBidder && (
        <nav className="p-4 bg-gray-800 shadow-lg flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <Link to="/" className="text-xl font-bold text-blue-400">Spectors.in Clone</Link>
            <div className="flex space-x-4">
              <Link to="/admin" className="hover:text-blue-300">Admin</Link>
              <Link to="/curator" className="hover:text-blue-300">Curator</Link>
            </div>
          </div>
          <a href="/bidder" target="_blank" rel="noopener noreferrer" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition text-sm">
            Open Bidder Portal ↗
          </a>
        </nav>
      )}
      <div className={isBidder ? "" : "p-6"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminPortal />} />
          <Route path="/curator" element={<CuratorPortal />} />
          <Route path="/bidder" element={<BidderPortal />} />
        </Routes>
      </div>
    </div>
  );
}

function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-6">
        Welcome to the Auction
      </h1>
      <p className="text-gray-400 max-w-lg mb-8 text-lg">
        Select a portal above to get started. Ensure the backend is running to enable real-time bidding via SignalR.
      </p>
    </div>
  );
}

export default App;
