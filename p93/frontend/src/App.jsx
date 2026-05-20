import { Routes, Route } from 'react-router-dom';
import { UserProvider } from './store/userStore';
import Layout from './components/Layout';
import Home from './pages/Home';
import CraftEditor from './pages/CraftEditor';
import CraftDetail from './pages/CraftDetail';
import UserProfile from './pages/UserProfile';
import Login from './pages/Login';

function App() {
  return (
    <UserProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="craft/new" element={<CraftEditor />} />
          <Route path="craft/:id/edit" element={<CraftEditor />} />
          <Route path="craft/:id" element={<CraftDetail />} />
          <Route path="user/:id" element={<UserProfile />} />
        </Route>
      </Routes>
    </UserProvider>
  );
}

export default App;
