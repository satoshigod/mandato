/* ============================================================
   MANDATO · Config compartido v2 (con Supabase Auth)
   Incluir como <script src="config.js"></script>
   ============================================================ */

window.MANDATO_CONFIG = {
  SUPABASE_URL: 'https://lrmlxhryfqyeutwfytwc.supabase.co',
  SUPABASE_ANON_KEY: 'PEGA_AQUI_TU_PUBLISHABLE_KEY',

  WOMPI_PUBLIC_KEY: 'pub_test_PEGA_AQUI_TU_LLAVE_PUBLICA',
  WOMPI_INTEGRITY_SECRET: '',

  WHATSAPP_NUMBER: '573005485019',
  EMPRESA_NOMBRE: 'Mandato',
  CIUDAD_DEFAULT: 'Medellín',

  SITE_URL: 'https://satoshigod.github.io/mandato',
};

/* ============================================================
   AUTH: cliente de Supabase Auth (REST directo)
   ============================================================ */
window.MANDATO_AUTH = (function() {
  var url = window.MANDATO_CONFIG.SUPABASE_URL;
  var key = window.MANDATO_CONFIG.SUPABASE_ANON_KEY;
  var SESSION_KEY = 'mandato_auth_session_v1';

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch(e) { return null; }
  }
  function setSession(session) {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }
  function getAccessToken() {
    var s = getSession();
    return s ? s.access_token : null;
  }
  function getUser() {
    var s = getSession();
    return s ? s.user : null;
  }

  function authHeaders(useUserToken) {
    var h = { 'apikey': key, 'Content-Type': 'application/json' };
    var token = useUserToken ? getAccessToken() : null;
    h['Authorization'] = 'Bearer ' + (token || key);
    return h;
  }

  function authRequest(path, body, method) {
    return fetch(url + '/auth/v1/' + path, {
      method: method || 'POST',
      headers: authHeaders(false),
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) {
      return r.json().then(function(data) {
        if (!r.ok) throw new Error(data.msg || data.error_description || data.error || ('Error ' + r.status));
        return data;
      });
    });
  }

  return {
    signUp: function(email, password) {
      return authRequest('signup', { email: email, password: password }).then(function(data) {
        if (data.access_token) setSession(data);
        return data;
      });
    },
    signIn: function(email, password) {
      return authRequest('token?grant_type=password', { email: email, password: password }).then(function(data) {
        setSession(data);
        return data;
      });
    },
    signOut: function() {
      var token = getAccessToken();
      setSession(null);
      if (!token) return Promise.resolve();
      return fetch(url + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + token }
      }).catch(function(){});
    },
    resetPassword: function(email) {
      var redirect = window.MANDATO_CONFIG.SITE_URL + '/recuperar.html';
      return authRequest('recover', { email: email, gotrue_meta_security: {}, redirect_to: redirect });
    },
    updatePassword: function(newPassword) {
      var token = getAccessToken();
      if (!token) return Promise.reject(new Error('No hay sesión'));
      return fetch(url + '/auth/v1/user', {
        method: 'PUT',
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      }).then(function(r) {
        return r.json().then(function(d) {
          if (!r.ok) throw new Error(d.msg || d.error_description || 'Error actualizando password');
          return d;
        });
      });
    },
    getSession: getSession,
    getUser: getUser,
    isAuthenticated: function() { return !!getAccessToken(); },
    // Process the recovery hash from URL (Supabase puts tokens in #access_token=... after recovery email)
    consumeRecoveryHash: function() {
      if (!window.location.hash) return null;
      var params = new URLSearchParams(window.location.hash.substring(1));
      var access = params.get('access_token');
      if (!access) return null;
      var session = {
        access_token: access,
        refresh_token: params.get('refresh_token'),
        token_type: params.get('token_type') || 'bearer',
        expires_in: parseInt(params.get('expires_in') || '3600'),
        user: null
      };
      setSession(session);
      // Limpiar el hash de la URL
      history.replaceState(null, '', window.location.pathname + window.location.search);
      return session;
    }
  };
})();

/* ============================================================
   DB: cliente de Supabase REST (con auth automática)
   ============================================================ */
window.MANDATO_DB = (function() {
  var url = window.MANDATO_CONFIG.SUPABASE_URL;
  var key = window.MANDATO_CONFIG.SUPABASE_ANON_KEY;

  function headers() {
    var h = { 'apikey': key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
    var token = window.MANDATO_AUTH.getAccessToken();
    h['Authorization'] = 'Bearer ' + (token || key);
    return h;
  }

  function request(method, path, body) {
    return fetch(url + '/rest/v1/' + path, {
      method: method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) {
      if (!r.ok) {
        return r.text().then(function(t) {
          throw new Error('Supabase ' + r.status + ': ' + t);
        });
      }
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') !== -1) return r.json();
      return null;
    });
  }

  return {
    select: function(table, filter) { return request('GET', table + (filter ? '?' + filter : '')); },
    insert: function(table, row) { return request('POST', table, row); },
    update: function(table, id, changes) { return request('PATCH', table + '?id=eq.' + encodeURIComponent(id), changes); },
    delete: function(table, id) { return request('DELETE', table + '?id=eq.' + encodeURIComponent(id)); },
    raw: request,
    isConfigured: function() { return key && key.indexOf('PEGA_AQUI') === -1; }
  };
})();

/* ============================================================
   HELPERS globales
   ============================================================ */
window.MANDATO_HELPERS = {
  formatCOP: function(n) {
    if (n === null || n === undefined || n === '') return '$0';
    var num = typeof n === 'string' ? parseInt(n.replace(/\D/g, '')) : n;
    if (isNaN(num)) return '$0';
    return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  timeAgo: function(timestamp) {
    var t = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    var seconds = Math.floor((Date.now() - t) / 1000);
    if (seconds < 60) return 'hace unos segundos';
    var m = Math.floor(seconds / 60);
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.floor(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.floor(h / 24);
    return 'hace ' + d + (d === 1 ? ' día' : ' días');
  },
  daysUntil: function(timestamp) {
    var t = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    var diff = t - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 3600 * 1000)));
  },
  escapeHtml: function(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  uid: function(prefix) { return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); },
  getURLParam: function(name) { return new URLSearchParams(window.location.search).get(name); },
  showToast: function(msg, type) {
    var existing = document.querySelector('.mandato-toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.className = 'mandato-toast' + (type ? ' toast-' + type : '');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1A1A18;color:#FAFAF7;padding:12px 20px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.2);max-width:90vw;text-align:center;';
    document.body.appendChild(t);
    setTimeout(function() { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; setTimeout(function(){ t.remove(); }, 500); }, 3000);
  }
};

/* ============================================================
   WOMPI integration (igual que antes)
   ============================================================ */
window.MANDATO_WOMPI = {
  open: function(opts) {
    var config = window.MANDATO_CONFIG;
    if (!config.WOMPI_PUBLIC_KEY || config.WOMPI_PUBLIC_KEY.indexOf('PEGA_AQUI') !== -1) {
      return this._simulatePayment(opts);
    }
    if (!window.WidgetCheckout) {
      var s = document.createElement('script');
      s.src = 'https://checkout.wompi.co/widget.js';
      s.onload = function() { window.MANDATO_WOMPI._launch(opts); };
      document.head.appendChild(s);
    } else { this._launch(opts); }
  },
  _launch: function(opts) {
    var config = window.MANDATO_CONFIG;
    var checkout = new window.WidgetCheckout({
      currency: 'COP',
      amountInCents: opts.amount * 100,
      reference: opts.reference,
      publicKey: config.WOMPI_PUBLIC_KEY,
      redirectUrl: opts.redirectUrl || (config.SITE_URL + '/pago-resultado.html'),
      customerData: { email: opts.email, fullName: opts.name, phoneNumber: opts.phone, phoneNumberPrefix: '+57' }
    });
    checkout.open(function(result) {
      var t = result.transaction;
      if (t && t.status === 'APPROVED') { if (opts.onSuccess) opts.onSuccess(t); }
      else { if (opts.onError) opts.onError(t); }
    });
  },
  _simulatePayment: function(opts) {
    var ok = confirm('MODO SIMULACIÓN\n\nPago de ' + window.MANDATO_HELPERS.formatCOP(opts.amount) + '\nReferencia: ' + opts.reference + '\n\n¿Simular pago aprobado?');
    setTimeout(function() {
      if (ok && opts.onSuccess) opts.onSuccess({ id: 'sim_' + Date.now(), status: 'APPROVED', reference: opts.reference, amountInCents: opts.amount * 100, paymentMethodType: 'SIMULATED' });
      else if (opts.onError) opts.onError({ status: 'DECLINED', reason: 'Cancelado' });
    }, 300);
  }
};
