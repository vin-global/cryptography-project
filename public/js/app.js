/**
 * App.js
 * Main application controller — handles SPA routing, navigation,
 * module initialization, and profile page.
 */

const App = {
  currentPage: null,
  modulesInitialized: false,

  async init() {
    Auth.init();

    // Bind navigation & hashchange immediately before async calls
    window.addEventListener('hashchange', () => this.handleRoute());

    const toggle = document.getElementById('sidebar-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.getElementById('nav-menu').classList.toggle('open');
      });
    }

    document.querySelectorAll('.nav-item a, .user-profile-link').forEach(link => {
      link.addEventListener('click', () => {
        const navMenu = document.getElementById('nav-menu');
        if (navMenu) navMenu.classList.remove('open');
      });
    });

    try {
      const isAuthenticated = await Auth.checkSession();
      if (isAuthenticated) {
        this.showApp();
      } else {
        this.showAuth();
      }
    } catch (e) {
      console.error('Session check failed:', e);
      this.showAuth();
    }
  },

  showAuth() {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const authPage = document.getElementById('auth-page');
    if (authPage) authPage.style.display = 'flex';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'none';
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.style.marginLeft = '0';
    window.location.hash = '';
  },

  showApp() {
    const authPage = document.getElementById('auth-page');
    if (authPage) authPage.style.display = 'none';

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'flex';

    const sidebarUser = document.getElementById('sidebar-user');
    if (sidebarUser) sidebarUser.style.display = 'flex';

    const sidebarUsername = document.getElementById('sidebar-username');
    if (sidebarUsername) {
      sidebarUsername.textContent = Auth.currentUser?.username || 'User';
    }

    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.style.marginLeft = '';

    // Only init modules once to avoid duplicate event listeners
    if (!this.modulesInitialized) {
      const modules = [
        ['HashingModule', HashingModule],
        ['SigningModule', SigningModule],
        ['MerkleModule', MerkleModule],
        ['BlockchainModule', BlockchainModule],
        ['DashboardModule', DashboardModule],
        ['ProfileModule', ProfileModule]
      ];

      for (const [name, mod] of modules) {
        try {
          if (mod && typeof mod.init === 'function') {
            mod.init();
          }
        } catch (err) {
          console.warn(`[App] ${name}.init() warning:`, err);
        }
      }

      this.modulesInitialized = true;
    }

    this.handleRoute();
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'hashing';
    this.navigateTo(hash);
  },

  navigateTo(page) {
    const validPages = ['hashing', 'signing', 'merkle', 'blockchain', 'dashboard', 'profile'];
    if (!validPages.includes(page)) page = 'hashing';

    document.querySelectorAll('.page').forEach(p => {
      p.style.display = 'none';
    });

    const targetPage = document.getElementById(`${page}-page`);
    if (targetPage) {
      targetPage.style.display = 'block';
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    if (window.location.hash !== `#${page}`) {
      window.location.hash = page;
    }

    this.currentPage = page;

    try {
      if (page === 'blockchain' && typeof BlockchainModule !== 'undefined') {
        BlockchainModule.loadChain();
      } else if (page === 'dashboard' && typeof DashboardModule !== 'undefined') {
        DashboardModule.loadDashboard();
      } else if (page === 'profile' && typeof ProfileModule !== 'undefined') {
        ProfileModule.loadProfile();
      }
    } catch (err) {
      console.warn(`[App] Error loading page ${page}:`, err);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
