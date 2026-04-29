/* ============================================================
   MANDATO · Config compartido
   Incluir este archivo como <script src="config.js"></script>
   ANTES de cualquier otro script en cada página HTML.
   ============================================================ */

window.MANDATO_CONFIG = {
  // ===== Supabase =====
  // Reemplaza con tus valores reales del dashboard de Supabase
  SUPABASE_URL: 'https://lrmlxhryfqyeutwfytwc.supabase.co',
  SUPABASE_ANON_KEY: 'PEGA_AQUI_TU_ANON_KEY',

  // ===== Wompi =====
  // Obtén tus llaves en https://comercios.wompi.co/
  // Para pruebas usa las llaves "test", para producción las "prod"
  WOMPI_PUBLIC_KEY: 'pub_test_PEGA_AQUI_TU_LLAVE_PUBLICA',
  WOMPI_INTEGRITY_SECRET: '', // No la pongas aquí, calcula la firma server-side

  // ===== Contacto y branding =====
  WHATSAPP_NUMBER: '573005485019',
  EMPRESA_NOMBRE: 'Mandato',
  CIUDAD_DEFAULT: 'Medellín',

  // ===== Admin =====
  ADMIN_PASSWORD: 'CAMBIA_ESTA_PASSWORD',

  // ===== URLs =====
  // URL base de tu sitio (sin / al final)
  SITE_URL: 'https://tu-dominio.com',
};

/* ============================================================
   Cliente de Supabase (REST API directo, sin librería)
   ============================================================ */
window.MANDATO_DB = (function() {
  var url = window.MANDATO_CONFIG.SUPABASE_URL;
  var key = window.MANDATO_CONFIG.SUPABASE_ANON_KEY;

  function headers() {
    return {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
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
    select: function(table, filter) {
      return request('GET', table + (filter ? '?' + filter : ''));
    },
    insert: function(table, row) {
      return request('POST', table, row);
    },
    update: function(table, id, changes) {
      return request('PATCH', table + '?id=eq.' + encodeURIComponent(id), changes);
    },
    delete: function(table, id) {
      return request('DELETE', table + '?id=eq.' + encodeURIComponent(id));
    },
    raw: request,
    isConfigured: function() {
      return key && key !== 'PEGA_AQUI_TU_ANON_KEY';
    }
  };
})();

/* ============================================================
   Helpers globales
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
  uid: function(prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  },
  getURLParam: function(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  },
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
   Wompi Widget integration
   ============================================================ */
window.MANDATO_WOMPI = {
  // Crea un widget de pago Wompi y lo inyecta en un container
  // Documentación: https://docs.wompi.co/docs/colombia/widget-checkout-web
  open: function(opts) {
    // opts = { amount: 79000, reference: 'sub_xxx', email: '...', onSuccess: fn, onError: fn }
    var config = window.MANDATO_CONFIG;
    if (!config.WOMPI_PUBLIC_KEY || config.WOMPI_PUBLIC_KEY.indexOf('PEGA_AQUI') !== -1) {
      // Modo simulado si no hay key configurada
      return this._simulatePayment(opts);
    }

    // Cargar script de Wompi si no está
    if (!window.WidgetCheckout) {
      var s = document.createElement('script');
      s.src = 'https://checkout.wompi.co/widget.js';
      s.onload = function() { window.MANDATO_WOMPI._launch(opts); };
      document.head.appendChild(s);
    } else {
      this._launch(opts);
    }
  },
  _launch: function(opts) {
    var config = window.MANDATO_CONFIG;
    var checkout = new window.WidgetCheckout({
      currency: 'COP',
      amountInCents: opts.amount * 100,
      reference: opts.reference,
      publicKey: config.WOMPI_PUBLIC_KEY,
      redirectUrl: opts.redirectUrl || (config.SITE_URL + '/pago-resultado.html'),
      customerData: {
        email: opts.email,
        fullName: opts.name,
        phoneNumber: opts.phone,
        phoneNumberPrefix: '+57'
      }
    });
    checkout.open(function(result) {
      var transaction = result.transaction;
      if (transaction && transaction.status === 'APPROVED') {
        if (opts.onSuccess) opts.onSuccess(transaction);
      } else {
        if (opts.onError) opts.onError(transaction);
      }
    });
  },
  _simulatePayment: function(opts) {
    // Simulación local cuando Wompi no está configurado
    var ok = confirm(
      'MODO SIMULACIÓN (Wompi no configurado)\n\n' +
      'Pago de ' + window.MANDATO_HELPERS.formatCOP(opts.amount) + '\n' +
      'Referencia: ' + opts.reference + '\n\n' +
      '¿Simular pago aprobado?'
    );
    setTimeout(function() {
      if (ok) {
        if (opts.onSuccess) opts.onSuccess({
          id: 'sim_' + Date.now(),
          status: 'APPROVED',
          reference: opts.reference,
          amountInCents: opts.amount * 100,
          paymentMethodType: 'SIMULATED'
        });
      } else {
        if (opts.onError) opts.onError({ status: 'DECLINED', reason: 'Cancelado por usuario' });
      }
    }, 300);
  }
};
