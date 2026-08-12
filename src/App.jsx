import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './App.css'

const LIMITE_PLAN_GRATIS = 15
const WHATSAPP_SOPORTE = '55395493' // tu número, el mismo que usaste en Supabase de prueba — cámbialo si es otro
const ADMIN_EMAIL = 'luismartz23@gmail.com'

function slugify(text) {
  return text
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function linkWhatsapp(telefono, mensaje) {
  const soloDigitos = (telefono || '').replace(/\D/g, '')
  const numero = soloDigitos.length === 8 ? `502${soloDigitos}` : soloDigitos
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`
}

export default function App() {
  const [session, setSession] = useState(null)
  const [vendedor, setVendedor] = useState(null)
  const [checkingVendedor, setCheckingVendedor] = useState(true)
  const [loadingSession, setLoadingSession] = useState(true)
  const [recovery, setRecovery] = useState(false)

  const path = window.location.pathname

  if (path.startsWith('/tienda/')) {
    const slug = path.replace('/tienda/', '')
    return <TiendaPublica slug={slug} />
  }

  if (path === '/admin') {
    return <AdminPanel />
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setCheckingVendedor(false); return }
    setCheckingVendedor(true)
    supabase
      .from('vendedores')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setVendedor(data)
        setCheckingVendedor(false)
      })
  }, [session])

  if (recovery) return <NuevaClave onDone={() => setRecovery(false)} />
  if (loadingSession) return <PantallaCarga />
  if (!session) return <Auth />
  if (session.user.email === ADMIN_EMAIL) return <AdminPanel />
  if (checkingVendedor) return <PantallaCarga />
  if (!vendedor) return <CrearTienda userId={session.user.id} correo={session.user.email} onCreated={setVendedor} />
  return <PanelVendedor vendedor={vendedor} setVendedor={setVendedor} />
}

function PantallaCarga() {
  return <div className="phone"><div className="empty" style={{paddingTop:100}}>Cargando…</div></div>
}

// ============================================
// CAMPO DE CONTRASEÑA CON OJITO
// ============================================
function CampoClave({ value, onChange, placeholder }) {
  const [ver, setVer] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <input
        type={ver ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        minLength={6}
        style={{ paddingRight:38 }}
      />
      <button
        type="button"
        onClick={() => setVer(v => !v)}
        style={{ position:'absolute', right:8, top:8, background:'none', border:'none', cursor:'pointer', fontSize:15 }}
        aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {ver ? '🙈' : '👁️'}
      </button>
    </div>
  )
}

// ============================================
// AUTENTICACIÓN (login / registro / olvidé mi contraseña)
// ============================================
function Auth() {
  const [modo, setModo] = useState('login') // login | registro | olvide
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    if (modo === 'olvide') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      })
      if (error) setMsg(error.message)
      else setMsg('Te enviamos un correo con un link para poner una nueva contraseña. Revisa también spam.')
      setLoading(false)
      return
    }

    if (modo === 'registro') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMsg(error.message)
      else setMsg('Cuenta creada. Ya puedes entrar con tu correo y contraseña.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message)
    }
    setLoading(false)
  }

  const titulo = modo === 'login' ? 'Iniciar sesión' : modo === 'registro' ? 'Crear cuenta' : 'Recuperar contraseña'

  return (
    <div className="phone">
      <header className="hero">
        <span className="live-badge"><span className="dot"></span>En vivo</span>
        <h1 className="brand">Vendé<span>Live</span></h1>
        <p className="tagline">Entra para administrar tu tienda</p>
      </header>
      <main>
        <div className="form-card">
          <h3>{titulo}</h3>
          <form onSubmit={handleSubmit}>
            <label>Correo</label>
            <input type="text" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" required />

            {modo !== 'olvide' && (
              <>
                <label>Contraseña</label>
                <CampoClave value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </>
            )}

            {msg && <p style={{fontSize:12, color: msg.includes('correo con') ? '#1FAE7C' : '#D62A48', marginTop:10}}>{msg}</p>}

            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? 'Un momento…' : modo === 'login' ? 'Entrar' : modo === 'registro' ? 'Registrarme' : 'Enviar link de recuperación'}
            </button>
          </form>

          {modo === 'login' && (
            <p style={{fontSize:12, marginTop:10, textAlign:'center'}}>
              <span style={{color:'#57536B', cursor:'pointer'}} onClick={()=>{ setModo('olvide'); setMsg('') }}>
                ¿Olvidaste tu contraseña?
              </span>
            </p>
          )}

          <p style={{fontSize:12, marginTop:10, textAlign:'center', color:'#57536B'}}>
            {modo === 'olvide' ? (
              <span style={{color:'#FF3B5C', fontWeight:600, cursor:'pointer'}} onClick={()=>{ setModo('login'); setMsg('') }}>
                Volver a iniciar sesión
              </span>
            ) : (
              <>
                {modo === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
                <span style={{color:'#FF3B5C', fontWeight:600, cursor:'pointer'}}
                  onClick={()=>{ setModo(modo==='login'?'registro':'login'); setMsg('') }}>
                  {modo === 'login' ? 'Regístrate' : 'Inicia sesión'}
                </span>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  )
}

// ============================================
// PONER NUEVA CONTRASEÑA (después de dar clic al link del correo)
// ============================================
function NuevaClave({ onDone }) {
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [listo, setListo] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setMsg(error.message)
    else setListo(true)
    setLoading(false)
  }

  return (
    <div className="phone">
      <header className="hero">
        <span className="live-badge"><span className="dot"></span>En vivo</span>
        <h1 className="brand">Vendé<span>Live</span></h1>
        <p className="tagline">Crea tu nueva contraseña</p>
      </header>
      <main>
        <div className="form-card">
          {listo ? (
            <>
              <h3>¡Listo!</h3>
              <p style={{fontSize:13, color:'#57536B', marginBottom:14}}>Tu contraseña se actualizó correctamente.</p>
              <button className="btn btn-primary" onClick={onDone}>Continuar</button>
            </>
          ) : (
            <>
              <h3>Nueva contraseña</h3>
              <form onSubmit={guardar}>
                <label>Contraseña nueva</label>
                <CampoClave value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                {msg && <p style={{fontSize:12, color:'#D62A48', marginTop:10}}>{msg}</p>}
                <button className="btn btn-primary" disabled={loading} type="submit">
                  {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ============================================
// AVATAR DE TIENDA (logo real, o inicial si no hay)
// ============================================
function Avatar({ nombre, logo_url, size = 18 }) {
  if (logo_url) {
    return <img src={logo_url} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
  }
  const inicial = nombre ? nombre.trim().charAt(0).toUpperCase() : '?'
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:'#FF3B5C', color:'#fff',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize: size*0.48
    }}>
      {inicial}
    </div>
  )
}

// ============================================
// SUBIR LOGO (reutilizable)
// ============================================
function SubirLogo({ preview, onFile }) {
  function handle(e) {
    const file = e.target.files[0]
    if (!file) return
    onFile(file)
  }
  return (
    <div className="photo-upload" style={{height:90, borderRadius:'50%', width:90, margin:'0 auto 12px'}}>
      {preview ? <img src={preview} /> : <span className="hint" style={{fontSize:10}}>Logo</span>}
      <input type="file" accept="image/*" onChange={handle} />
    </div>
  )
}

// ============================================
// CREAR TIENDA
// ============================================
function CrearTienda({ userId, correo, onCreated }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [logo, setLogo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  function onLogoFile(file) {
    setLogo(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function crear(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    let logo_url = null
    if (logo) {
      const nombreArchivo = `logos/${userId}-${Date.now()}-${logo.name}`
      const { error: upErr } = await supabase.storage.from('productos').upload(nombreArchivo, logo)
      if (!upErr) {
        const { data } = supabase.storage.from('productos').getPublicUrl(nombreArchivo)
        logo_url = data.publicUrl
      }
    }

    let slug = slugify(nombre)
    let intento = 0
    let resultado = null
    while (intento < 5 && !resultado) {
      const slugFinal = intento === 0 ? slug : `${slug}-${Math.floor(Math.random()*1000)}`
      const { data, error } = await supabase
        .from('vendedores')
        .insert({ user_id: userId, nombre_tienda: nombre, slug: slugFinal, correo, telefono, logo_url })
        .select()
        .single()
      if (!error) resultado = data
      else if (!error.message.includes('duplicate')) { setMsg(error.message); break }
      intento++
    }
    if (resultado) onCreated(resultado)
    else if (!msg) setMsg('No se pudo crear la tienda, intenta con otro nombre.')
    setLoading(false)
  }

  return (
    <div className="phone">
      <header className="hero">
        <span className="live-badge"><span className="dot"></span>En vivo</span>
        <h1 className="brand">Vendé<span>Live</span></h1>
        <p className="tagline">Un último paso antes de empezar</p>
      </header>
      <main>
        <div className="form-card">
          <h3>Nombre de tu tienda o emprendimiento</h3>
          <form onSubmit={crear}>
            <SubirLogo preview={logoPreview} onFile={onLogoFile} />
            <input type="text" value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej. Modas Ana" required />
            <label>Teléfono de contacto</label>
            <input type="text" value={telefono} onChange={e=>setTelefono(e.target.value)} placeholder="0000-0000" />
            {msg && <p style={{fontSize:12, color:'#D62A48', marginTop:10}}>{msg}</p>}
            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? 'Creando…' : 'Crear mi tienda'}
            </button>
          </form>
          <p style={{fontSize:11.5, marginTop:14, textAlign:'center', color:'#57536B', cursor:'pointer', textDecoration:'underline'}}
            onClick={()=>supabase.auth.signOut()}>
            Esta no es mi cuenta — cerrar sesión
          </p>
        </div>
      </main>
    </div>
  )
}

// ============================================
// PANEL DEL VENDEDOR
// ============================================
function PanelVendedor({ vendedor, setVendedor }) {
  const [vista, setVista] = useState('productos') // productos | pedidos
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [fotosNuevas, setFotosNuevas] = useState([]) // File[]
  const [fotosNuevasPreview, setFotosNuevasPreview] = useState([]) // string[] (object URLs)
  const [fotosExistentes, setFotosExistentes] = useState([]) // string[] (urls ya guardadas)
  const [form, setForm] = useState({ codigo:'', nombre:'', descripcion:'', precio:'', existencia:'', unidad:'unidad' })
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [logoNuevo, setLogoNuevo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(vendedor.logo_url)
  const [guardandoLogo, setGuardandoLogo] = useState(false)
  const [frase, setFrase] = useState(vendedor.frase || '')
  const [telefonoInfo, setTelefonoInfo] = useState(vendedor.telefono || '')
  const [guardandoInfo, setGuardandoInfo] = useState(false)
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [compararActivo, setCompararActivo] = useState(false)
  const [compararDesde, setCompararDesde] = useState('')
  const [compararHasta, setCompararHasta] = useState('')

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('*').eq('vendedor_id', vendedor.id).order('creado_en', { ascending:false })
    setProductos(data || [])
  }
  useEffect(() => { cargarProductos() }, [])

  async function cargarPedidos() {
    const { data } = await supabase
      .from('pedidos')
      .select('*, productos(nombre, codigo, descripcion)')
      .eq('vendedor_id', vendedor.id)
      .order('creado_en', { ascending:false })
    setPedidos(data || [])
  }
  useEffect(() => { if (vista === 'pedidos' || vista === 'analisis') cargarPedidos() }, [vista])

  async function cambiarEstadoPedido(id, nuevoEstado) {
    await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', id)
    cargarPedidos()
  }

  function exportarExcel() {
    const escapar = v => `"${String(v ?? '').replace(/"/g,'""')}"`
    const encabezados = ['Fecha','N° Pedido','Producto','Código','Cantidad','Precio unitario','Total','Cliente','Teléfono','Dirección','Observación','Estado']
    const filas = pedidosFiltrados.map(p => [
      new Date(p.creado_en).toLocaleDateString('es-GT'),
      p.id.slice(0,8).toUpperCase(),
      p.productos?.nombre || '',
      p.productos?.codigo || '',
      p.cantidad,
      (p.precio_unitario || 0).toFixed(2),
      ((p.precio_unitario || 0) * p.cantidad).toFixed(2),
      p.nombre_cliente,
      p.telefono_cliente,
      p.direccion_cliente,
      p.observacion || '',
      p.estado
    ])
    const csv = '\uFEFF' + [encabezados, ...filas].map(fila => fila.map(escapar).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const rango = filtroDesde || filtroHasta ? `${filtroDesde||'inicio'}_a_${filtroHasta||'hoy'}` : 'todos'
    a.href = url
    a.download = `pedidos_${vendedor.slug}_${rango}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportarPDF() {
    const rango = (filtroDesde || filtroHasta) ? `${filtroDesde||'…'} al ${filtroHasta||'hoy'}` : 'Todos los pedidos'
    const filas = pedidosFiltrados.map(p => `
      <tr>
        <td>${new Date(p.creado_en).toLocaleDateString('es-GT')}</td>
        <td>${p.id.slice(0,8).toUpperCase()}</td>
        <td>${p.productos?.nombre || ''}</td>
        <td>${p.cantidad}</td>
        <td>Q${((p.precio_unitario||0)*p.cantidad).toFixed(2)}</td>
        <td>${p.nombre_cliente}<br><span class="sub">${p.telefono_cliente}</span></td>
        <td>${p.estado}</td>
      </tr>`).join('')
    const ventana = window.open('', '_blank')
    ventana.document.write(`
      <html><head><title>Pedidos ${vendedor.nombre_tienda}</title>
      <style>
        body{ font-family: Arial, sans-serif; padding:24px; color:#111; }
        h1{ font-size:18px; margin:0; }
        .meta{ font-size:12px; color:#666; margin-top:2px; margin-bottom:16px; }
        table{ width:100%; border-collapse:collapse; font-size:11.5px; }
        th{ text-align:left; background:#17162A; color:#fff; padding:8px 6px; }
        td{ padding:7px 6px; border-bottom:1px solid #eee; vertical-align:top; }
        .sub{ color:#888; font-size:10.5px; }
        .resumen{ margin-top:18px; font-size:13px; font-weight:bold; }
      </style></head>
      <body>
        <h1>${vendedor.nombre_tienda} — Reporte de pedidos</h1>
        <div class="meta">Periodo: ${rango} · Generado el ${new Date().toLocaleDateString('es-GT')}</div>
        <table>
          <thead><tr><th>Fecha</th><th>Pedido</th><th>Producto</th><th>Cant.</th><th>Total</th><th>Cliente</th><th>Estado</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <div class="resumen">Total: ${resumen.pedidos} pedidos · Q${resumen.ingresos.toFixed(2)} en ventas</div>
      </body></html>
    `)
    ventana.document.close()
    ventana.focus()
    ventana.print()
  }

  function imprimirGuia(p) {
    const fecha = new Date(p.creado_en).toLocaleDateString('es-GT', { day:'2-digit', month:'2-digit', year:'numeric' })
    const ventana = window.open('', '_blank', 'width=380,height=520')
    ventana.document.write(`
      <html><head><title>Guía ${p.id.slice(0,8).toUpperCase()}</title>
      <style>
        @page{ size:80mm 110mm; margin:5mm; }
        *{ box-sizing:border-box; }
        body{ font-family: Arial, sans-serif; padding:0; margin:0; color:#111; width:70mm; line-height:1.5; }
        h2{ margin:0 0 4px; font-size:16px; }
        .codigo{ font-family: monospace; font-size:11px; color:#555; margin-bottom:12px; }
        .linea{ border-top:1px dashed #999; margin:12px 0; }
        p{ margin:5px 0; font-size:13.5px; }
        .etq{ font-size:10px; color:#777; text-transform:uppercase; letter-spacing:0.04em; margin-top:10px; }
      </style></head>
      <body>
        <h2>${vendedor.nombre_tienda}</h2>
        <div class="codigo">Pedido: ${p.id.slice(0,8).toUpperCase()} · ${fecha}</div>
        <div class="linea"></div>
        <p class="etq">Producto</p>
        <p><strong>${p.productos?.nombre || ''}</strong> (Cód. ${p.productos?.codigo || ''}) × ${p.cantidad}</p>
        <div class="linea"></div>
        <p class="etq">Enviar a</p>
        <p><strong>${p.nombre_cliente}</strong></p>
        <p>${p.telefono_cliente}</p>
        <p>${p.direccion_cliente}</p>
        ${p.observacion ? `<p class="etq">Observación</p><p>${p.observacion}</p>` : ''}
      </body></html>
    `)
    ventana.document.close()
    ventana.focus()
    ventana.print()
  }

  const pedidosNuevos = pedidos.filter(p => p.estado === 'nuevo').length

  const pedidosFiltrados = pedidos.filter(p => {
    const fecha = p.creado_en.slice(0,10)
    if (filtroDesde && fecha < filtroDesde) return false
    if (filtroHasta && fecha > filtroHasta) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const enCliente = p.nombre_cliente?.toLowerCase().includes(q)
      const enProducto = p.productos?.nombre?.toLowerCase().includes(q)
      const enId = p.id.toUpperCase().includes(busqueda.toUpperCase())
      if (!enCliente && !enProducto && !enId) return false
    }
    return true
  })

  const resumen = pedidosFiltrados.reduce((acc, p) => {
    if (p.estado === 'cancelado') return acc
    acc.pedidos += 1
    acc.unidades += p.cantidad
    acc.ingresos += (p.precio_unitario || 0) * p.cantidad
    return acc
  }, { pedidos:0, unidades:0, ingresos:0 })

  const pedidosValidos = pedidosFiltrados.filter(p => p.estado !== 'cancelado')

  const clientesUnicos = new Set(pedidosValidos.map(p => p.telefono_cliente)).size

  const topProductosMap = {}
  pedidosValidos.forEach(p => {
    const nombre = p.productos?.nombre || 'Producto eliminado'
    if (!topProductosMap[nombre]) topProductosMap[nombre] = { unidades:0, ingresos:0 }
    topProductosMap[nombre].unidades += p.cantidad
    topProductosMap[nombre].ingresos += (p.precio_unitario || 0) * p.cantidad
  })
  const topProductos = Object.entries(topProductosMap)
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a,b) => b.ingresos - a.ingresos)
    .slice(0, 5)
  const maxIngresoTop = Math.max(1, ...topProductos.map(p => p.ingresos))

  const coloresEstado = { nuevo:'#F5A623', confirmado:'#1D6FA5', entregado:'#1FAE7C', cancelado:'#D62A48' }
  const estadosCount = { nuevo:0, confirmado:0, entregado:0, cancelado:0 }
  pedidosFiltrados.forEach(p => { estadosCount[p.estado] = (estadosCount[p.estado]||0) + 1 })
  const totalEstados = Object.values(estadosCount).reduce((a,b)=>a+b,0) || 1
  let acumulado = 0
  const gradientePartes = Object.entries(estadosCount).map(([estado, count]) => {
    const inicio = (acumulado / totalEstados) * 100
    acumulado += count
    const fin = (acumulado / totalEstados) * 100
    return `${coloresEstado[estado]} ${inicio}% ${fin}%`
  })
  const donutEstados = `conic-gradient(${gradientePartes.join(', ')})`

  const ventasPorDiaMap = {}
  pedidosValidos.forEach(p => {
    const dia = p.creado_en.slice(0,10)
    ventasPorDiaMap[dia] = (ventasPorDiaMap[dia] || 0) + (p.precio_unitario || 0) * p.cantidad
  })
  const ventasPorDia = Object.entries(ventasPorDiaMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-10)
  const maxVentaDia = Math.max(1, ...ventasPorDia.map(([,v])=>v))

  const isoFecha = d => d.toISOString().slice(0,10)

  function aplicarPreset(preset) {
    const hoy = new Date()
    if (preset === 'hoy') {
      setFiltroDesde(isoFecha(hoy)); setFiltroHasta(isoFecha(hoy))
    } else if (preset === '7dias') {
      const ini = new Date(hoy); ini.setDate(ini.getDate() - 6)
      setFiltroDesde(isoFecha(ini)); setFiltroHasta(isoFecha(hoy))
    } else if (preset === 'mes') {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      setFiltroDesde(isoFecha(ini)); setFiltroHasta(isoFecha(hoy))
    } else if (preset === 'mesAnterior') {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1)
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      setFiltroDesde(isoFecha(ini)); setFiltroHasta(isoFecha(fin))
    } else if (preset === 'todo') {
      setFiltroDesde(''); setFiltroHasta('')
    }
  }

  function activarComparacion() {
    if (!compararDesde && !compararHasta) {
      const hoy = new Date()
      const ini = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1)
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      setCompararDesde(isoFecha(ini)); setCompararHasta(isoFecha(fin))
    }
    setCompararActivo(true)
  }

  function calcularResumenRango(desde, hasta) {
    const filtrados = pedidos.filter(p => {
      const fecha = p.creado_en.slice(0,10)
      if (desde && fecha < desde) return false
      if (hasta && fecha > hasta) return false
      return true
    })
    const validos = filtrados.filter(p => p.estado !== 'cancelado')
    return {
      pedidos: validos.length,
      unidades: validos.reduce((a,p)=>a+p.cantidad, 0),
      ingresos: validos.reduce((a,p)=>a+(p.precio_unitario||0)*p.cantidad, 0),
      clientes: new Set(validos.map(p=>p.telefono_cliente)).size
    }
  }

  const resumenComparacion = compararActivo ? calcularResumenRango(compararDesde, compararHasta) : null

  function calcularDelta(actual, anterior) {
    if (!compararActivo || anterior === undefined) return null
    if (anterior === 0) return actual > 0 ? 100 : null
    return ((actual - anterior) / anterior) * 100
  }

  function BadgeDelta({ valor }) {
    if (valor === null || valor === undefined) return null
    const positivo = valor >= 0
    return (
      <div style={{ fontSize:10, marginTop:2, fontWeight:700, color: positivo ? '#1FAE7C' : '#D62A48' }}>
        {positivo ? '▲' : '▼'} {Math.abs(valor).toFixed(0)}% vs periodo anterior
      </div>
    )
  }

  function mostrarToast(m) {
    setToast(m)
    setTimeout(()=>setToast(''), 2200)
  }

  function resetForm() {
    setEditingId(null)
    setForm({ codigo:'', nombre:'', descripcion:'', precio:'', existencia:'', unidad:'unidad' })
    setFotosNuevas([])
    setFotosNuevasPreview([])
    setFotosExistentes([])
  }

  function editar(p) {
    setEditingId(p.id)
    setForm({ codigo:p.codigo, nombre:p.nombre, descripcion:p.descripcion||'', precio:p.precio, existencia:p.existencia, unidad:p.unidad||'unidad' })
    const galeria = (p.fotos && p.fotos.length > 0) ? p.fotos : (p.foto_url ? [p.foto_url] : [])
    setFotosExistentes(galeria)
    setFotosNuevas([])
    setFotosNuevasPreview([])
  }

  async function eliminar(id) {
    await supabase.from('productos').delete().eq('id', id)
    mostrarToast('Producto eliminado')
    cargarProductos()
  }

  async function guardar(e) {
    e.preventDefault()
    if (!editingId && vendedor.plan !== 'pro' && productos.length >= LIMITE_PLAN_GRATIS) {
      mostrarToast(`⚠️ Llegaste al límite de ${LIMITE_PLAN_GRATIS} productos de tu plan gratis`)
      return
    }
    setSaving(true)
    const urlsNuevas = []
    for (const file of fotosNuevas) {
      const nombreArchivo = `${vendedor.id}/${Date.now()}-${Math.floor(Math.random()*10000)}-${file.name}`
      const { error: upErr } = await supabase.storage.from('productos').upload(nombreArchivo, file)
      if (!upErr) {
        const { data } = supabase.storage.from('productos').getPublicUrl(nombreArchivo)
        urlsNuevas.push(data.publicUrl)
      }
    }
    const fotos = [...fotosExistentes, ...urlsNuevas]
    const payload = {
      vendedor_id: vendedor.id,
      codigo: form.codigo,
      nombre: form.nombre,
      descripcion: form.descripcion,
      precio: parseFloat(form.precio),
      existencia: parseInt(form.existencia),
      unidad: form.unidad,
      fotos,
      foto_url: fotos[0] || null
    }
    if (editingId) {
      await supabase.from('productos').update(payload).eq('id', editingId)
      mostrarToast('Producto actualizado')
    } else {
      await supabase.from('productos').insert(payload)
      mostrarToast('Producto agregado')
    }
    resetForm()
    cargarProductos()
    setSaving(false)
  }

  function onFotosChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setFotosNuevas(f => [...f, ...files])
    setFotosNuevasPreview(f => [...f, ...files.map(file => URL.createObjectURL(file))])
    e.target.value = ''
  }

  function quitarFotoExistente(url) {
    setFotosExistentes(f => f.filter(u => u !== url))
  }

  function quitarFotoNueva(idx) {
    setFotosNuevas(f => f.filter((_, i) => i !== idx))
    setFotosNuevasPreview(f => f.filter((_, i) => i !== idx))
  }

  function onLogoNuevoFile(file) {
    setLogoNuevo(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function guardarLogo() {
    if (!logoNuevo) return
    setGuardandoLogo(true)
    const nombreArchivo = `logos/${vendedor.id}-${Date.now()}-${logoNuevo.name}`
    const { error: upErr } = await supabase.storage.from('productos').upload(nombreArchivo, logoNuevo)
    if (!upErr) {
      const { data } = supabase.storage.from('productos').getPublicUrl(nombreArchivo)
      await supabase.from('vendedores').update({ logo_url: data.publicUrl }).eq('id', vendedor.id)
      setVendedor({ ...vendedor, logo_url: data.publicUrl })
      mostrarToast('Logo actualizado')
      setLogoNuevo(null)
    }
    setGuardandoLogo(false)
  }

  async function guardarInfo() {
    setGuardandoInfo(true)
    await supabase.from('vendedores').update({ frase, telefono: telefonoInfo }).eq('id', vendedor.id)
    setVendedor({ ...vendedor, frase, telefono: telefonoInfo })
    mostrarToast('Información actualizada')
    setGuardandoInfo(false)
  }

  const link = `${window.location.origin}/tienda/${vendedor.slug}`

  return (
    <div className="phone">
      <header className="hero">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <span className="live-badge"><span className="dot"></span>En vivo</span>
          <p style={{fontSize:11, cursor:'pointer', color:'#B8B4C9', textDecoration:'underline', margin:0}}
            onClick={()=>supabase.auth.signOut()}>
            Cerrar sesión
          </p>
        </div>
        <div style={{textAlign:'center', marginTop:14}}>
          <Avatar nombre={vendedor.nombre_tienda} logo_url={vendedor.logo_url} size={76} />
          <h1 style={{fontFamily:"'Space Grotesk',sans-serif", fontSize:21, fontWeight:700, marginTop:10, color:'#fff'}}>{vendedor.nombre_tienda}</h1>
          <p style={{fontSize:14, color:'#D9D5EA', marginTop:3, fontWeight:500}}>{vendedor.frase || 'Catálogo'}</p>
          {vendedor.telefono && (
            <a href={linkWhatsapp(vendedor.telefono)} target="_blank" rel="noreferrer" style={{
              display:'inline-flex', alignItems:'center', gap:6, marginTop:8,
              background:'rgba(37,211,102,0.18)', border:'1px solid rgba(37,211,102,0.4)', padding:'5px 12px', borderRadius:999,
              fontSize:12, color:'#fff', textDecoration:'none', fontWeight:600
            }}>💬 WhatsApp · {vendedor.telefono}</a>
          )}
        </div>
      </header>
      <main>
        <div style={{display:'flex', gap:8, marginBottom:16, background:'#F1EDE4', padding:4, borderRadius:14}}>
          <div onClick={()=>setVista('productos')} style={{
            flex:1, textAlign:'center', padding:'9px 6px', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
            fontSize:12.5, borderRadius:11, cursor:'pointer',
            background: vista==='productos' ? '#17162A' : 'transparent',
            color: vista==='productos' ? '#fff' : '#57536B'
          }}>Productos</div>
          <div onClick={()=>setVista('pedidos')} style={{
            flex:1, textAlign:'center', padding:'9px 6px', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
            fontSize:12.5, borderRadius:11, cursor:'pointer', position:'relative',
            background: vista==='pedidos' ? '#17162A' : 'transparent',
            color: vista==='pedidos' ? '#fff' : '#57536B'
          }}>
            Pedidos{pedidosNuevos > 0 && <span style={{marginLeft:6, background:'#FF3B5C', color:'#fff', fontSize:10, padding:'1px 6px', borderRadius:999}}>{pedidosNuevos}</span>}
          </div>
          <div onClick={()=>setVista('analisis')} style={{
            flex:1, textAlign:'center', padding:'9px 6px', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
            fontSize:12.5, borderRadius:11, cursor:'pointer',
            background: vista==='analisis' ? '#17162A' : 'transparent',
            color: vista==='analisis' ? '#fff' : '#57536B'
          }}>📊 Análisis</div>
        </div>

        {vista === 'pedidos' ? (
          <>
            <div className="form-card">
              <h3>Buscar</h3>
              <input type="text" value={busqueda} onChange={e=>setBusqueda(e.target.value)}
                placeholder="Nombre del cliente, producto o # de pedido" />
            </div>

            <div className="form-card">
              <h3>Filtrar por fecha</h3>
              <div className="row2">
                <div style={{flex:1}}>
                  <label>Desde</label>
                  <input type="date" value={filtroDesde} onChange={e=>setFiltroDesde(e.target.value)} />
                </div>
                <div style={{flex:1}}>
                  <label>Hasta</label>
                  <input type="date" value={filtroHasta} onChange={e=>setFiltroHasta(e.target.value)} />
                </div>
              </div>
              {(filtroDesde || filtroHasta) && (
                <button type="button" className="btn" style={{marginTop:8, background:'#F1EDE4'}}
                  onClick={()=>{setFiltroDesde(''); setFiltroHasta('')}}>Quitar filtro</button>
              )}
              <div className="row2" style={{marginTop:8}}>
                <button type="button" className="btn" style={{background:'#1FAE7C', color:'#fff'}}
                  onClick={exportarExcel} disabled={pedidosFiltrados.length===0}>
                  📥 Excel ({pedidosFiltrados.length})
                </button>
                <button type="button" className="btn" style={{background:'#D62A48', color:'#fff'}}
                  onClick={exportarPDF} disabled={pedidosFiltrados.length===0}>
                  🧾 PDF
                </button>
              </div>
            </div>

            <div className="form-card" style={{display:'flex', justifyContent:'space-around', textAlign:'center'}}>
              <div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:18}}>{resumen.pedidos}</div>
                <div style={{fontSize:11, color:'#57536B'}}>Pedidos</div>
              </div>
              <div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:18}}>{resumen.unidades}</div>
                <div style={{fontSize:11, color:'#57536B'}}>Unidades</div>
              </div>
              <div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:18, color:'#1FAE7C'}}>Q{resumen.ingresos.toFixed(2)}</div>
                <div style={{fontSize:11, color:'#57536B'}}>Ingresos</div>
              </div>
            </div>

            <div className="section-title">Pedidos <span className="count-pill">{pedidosFiltrados.length}</span></div>
            {pedidosFiltrados.length === 0 && <div className="empty">No hay pedidos en este rango.</div>}
            {pedidosFiltrados.map(p => (
              <div className="form-card" key={p.id}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:700, fontSize:13.5}}>{p.productos?.nombre} × {p.cantidad}</div>
                    <span className="codigo">{p.productos?.codigo}</span>
                    {p.productos?.descripcion && <div style={{fontSize:11.5, color:'#57536B', marginTop:3}}>{p.productos.descripcion}</div>}
                  </div>
                  <span className="stock-badge" style={{
                    background: p.estado==='nuevo' ? '#FDE9CC' : p.estado==='confirmado' ? '#E4F0F6' : p.estado==='entregado' ? '#E4F6EF' : '#FDE3E7',
                    color: p.estado==='nuevo' ? '#B5750B' : p.estado==='confirmado' ? '#1D6FA5' : p.estado==='entregado' ? '#1FAE7C' : '#D62A48'
                  }}>{p.estado}</span>
                </div>
                <div style={{fontSize:12, color:'#57536B', lineHeight:1.6}}>
                  <div><strong>{p.nombre_cliente}</strong> · {p.telefono_cliente}</div>
                  <div>{p.direccion_cliente}</div>
                  {p.observacion && <div>Obs: {p.observacion}</div>}
                  <div style={{fontSize:11, marginTop:4}}>
                    #{p.id.slice(0,8).toUpperCase()} ·{' '}
                    {new Date(p.creado_en).toLocaleDateString('es-GT', { day:'2-digit', month:'short', year:'numeric' })}
                    {' · Q'}{(p.precio_unitario ? p.precio_unitario * p.cantidad : 0).toFixed(2)}
                  </div>
                </div>
                <div className="row2" style={{marginTop:12}}>
                  {(p.estado === 'nuevo' || p.estado === 'confirmado') && (
                    <>
                      {p.estado === 'nuevo' && (
                        <button className="btn" style={{background:'#1D6FA5', color:'#fff'}} onClick={()=>cambiarEstadoPedido(p.id,'confirmado')}>Confirmar</button>
                      )}
                      {p.estado === 'confirmado' && (
                        <button className="btn" style={{background:'#1FAE7C', color:'#fff'}} onClick={()=>cambiarEstadoPedido(p.id,'entregado')}>Entregado</button>
                      )}
                      <button className="btn" style={{background:'#F1EDE4', color:'#17162A'}} onClick={()=>cambiarEstadoPedido(p.id,'cancelado')}>Cancelar</button>
                    </>
                  )}
                </div>
                <button className="btn" style={{marginTop:8, background:'#17162A', color:'#fff'}} onClick={()=>imprimirGuia(p)}>
                  🖨️ Imprimir guía
                </button>
              </div>
            ))}
          </>
        ) : vista === 'analisis' ? (
          <>
            <div className="form-card">
              <h3>Periodo a analizar</h3>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                {[['hoy','Hoy'],['7dias','Últimos 7 días'],['mes','Este mes'],['mesAnterior','Mes anterior'],['todo','Todo']].map(([key,label]) => (
                  <button key={key} type="button" onClick={()=>aplicarPreset(key)} style={{
                    fontSize:11, fontWeight:600, padding:'6px 10px', borderRadius:999, border:'1px solid #EAE4D8',
                    background:'#F1EDE4', color:'#17162A', cursor:'pointer'
                  }}>{label}</button>
                ))}
              </div>
              <div className="row2">
                <div style={{flex:1}}>
                  <label>Desde</label>
                  <input type="date" value={filtroDesde} onChange={e=>setFiltroDesde(e.target.value)} />
                </div>
                <div style={{flex:1}}>
                  <label>Hasta</label>
                  <input type="date" value={filtroHasta} onChange={e=>setFiltroHasta(e.target.value)} />
                </div>
              </div>

              {!compararActivo ? (
                <button type="button" className="btn" style={{marginTop:12, background:'#F1EDE4'}} onClick={activarComparacion}>
                  📊 Comparar con otro periodo
                </button>
              ) : (
                <div style={{marginTop:12, paddingTop:12, borderTop:'1px dashed #EAE4D8'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <label style={{margin:0}}>Comparar contra</label>
                    <span style={{fontSize:11, color:'#FF3B5C', fontWeight:600, cursor:'pointer'}} onClick={()=>setCompararActivo(false)}>Quitar</span>
                  </div>
                  <div className="row2">
                    <div style={{flex:1}}>
                      <label>Desde</label>
                      <input type="date" value={compararDesde} onChange={e=>setCompararDesde(e.target.value)} />
                    </div>
                    <div style={{flex:1}}>
                      <label>Hasta</label>
                      <input type="date" value={compararHasta} onChange={e=>setCompararHasta(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              <div className="form-card" style={{ textAlign:'center', margin:0 }}>
                <div style={{fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:20, color:'#1FAE7C'}}>Q{resumen.ingresos.toFixed(2)}</div>
                <div style={{fontSize:11, color:'#57536B'}}>Ventas totales</div>
                <BadgeDelta valor={calcularDelta(resumen.ingresos, resumenComparacion?.ingresos)} />
              </div>
              <div className="form-card" style={{ textAlign:'center', margin:0 }}>
                <div style={{fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:20}}>{resumen.pedidos}</div>
                <div style={{fontSize:11, color:'#57536B'}}>Pedidos</div>
                <BadgeDelta valor={calcularDelta(resumen.pedidos, resumenComparacion?.pedidos)} />
              </div>
              <div className="form-card" style={{ textAlign:'center', margin:0 }}>
                <div style={{fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:20}}>{resumen.unidades}</div>
                <div style={{fontSize:11, color:'#57536B'}}>Unidades vendidas</div>
                <BadgeDelta valor={calcularDelta(resumen.unidades, resumenComparacion?.unidades)} />
              </div>
              <div className="form-card" style={{ textAlign:'center', margin:0 }}>
                <div style={{fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:20}}>{clientesUnicos}</div>
                <div style={{fontSize:11, color:'#57536B'}}>Clientes distintos</div>
                <BadgeDelta valor={calcularDelta(clientesUnicos, resumenComparacion?.clientes)} />
              </div>
            </div>

            <div className="form-card">
              <h3>Top 5 productos más vendidos</h3>
              {topProductos.length === 0 && <div className="empty" style={{padding:'20px 0'}}>Sin ventas todavía en este rango.</div>}
              {topProductos.map((p, i) => (
                <div key={p.nombre} style={{ position:'relative', marginBottom:8, borderRadius:10, overflow:'hidden', background:'#F1EDE4' }}>
                  <div style={{ position:'absolute', inset:0, width:`${(p.ingresos/maxIngresoTop)*100}%`, background:'rgba(255,59,92,0.16)' }} />
                  <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px' }}>
                    <span style={{ fontSize:12.5, fontWeight:600 }}>#{i+1} {p.nombre}</span>
                    <span style={{ fontSize:12, fontWeight:700, whiteSpace:'nowrap', marginLeft:8 }}>Q{p.ingresos.toFixed(2)} · {p.unidades}u</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="form-card" style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:96, height:96, borderRadius:'50%', background: donutEstados, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <h3 style={{marginBottom:8}}>Pedidos por estado</h3>
                {Object.entries(estadosCount).map(([estado, count]) => (
                  <div key={estado} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11.5, marginBottom:3 }}>
                    <span style={{ width:9, height:9, borderRadius:'50%', background:coloresEstado[estado], display:'inline-block' }} />
                    <span style={{ textTransform:'capitalize', flex:1 }}>{estado}</span>
                    <span style={{ fontWeight:700 }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-card">
              <h3>Ventas por día</h3>
              {ventasPorDia.length === 0 && <div className="empty" style={{padding:'20px 0'}}>Sin ventas todavía en este rango.</div>}
              {ventasPorDia.length > 0 && (
                <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120, marginTop:10 }}>
                  {ventasPorDia.map(([dia, monto]) => (
                    <div key={dia} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      <div style={{ fontSize:9, color:'#57536B' }}>{monto>0 ? `Q${Math.round(monto)}` : ''}</div>
                      <div style={{
                        width:'100%', borderRadius:'5px 5px 0 0',
                        height: Math.max(4, (monto/maxVentaDia)*80),
                        background: '#FF3B5C'
                      }} />
                      <div style={{ fontSize:8.5, color:'#57536B' }}>{new Date(dia+'T00:00:00').toLocaleDateString('es-GT',{day:'2-digit',month:'2-digit'})}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
        <>
        <div className="form-card">
          <h3>Tu link de tienda</h3>
          <p style={{fontSize:12.5, color:'#57536B', wordBreak:'break-all'}}>{link}</p>
          <button className="btn btn-primary" onClick={()=>{navigator.clipboard.writeText(link); mostrarToast('Link copiado')}}>Copiar link</button>
          {vendedor.estado !== 'activo' && (
            <p style={{fontSize:11.5, color:'#D62A48', marginTop:10}}>
              ⚠️ Tu tienda está "{vendedor.estado}" — el link público aún no será visible hasta aprobación.
            </p>
          )}
        </div>

        <div className="form-card">
          <h3>Logo de tu tienda</h3>
          <SubirLogo preview={logoPreview} onFile={onLogoNuevoFile} />
          {logoNuevo && (
            <button className="btn btn-primary" disabled={guardandoLogo} onClick={guardarLogo}>
              {guardandoLogo ? 'Guardando…' : 'Guardar logo'}
            </button>
          )}
          <label>Frase de tu tienda</label>
          <input type="text" value={frase} onChange={e=>setFrase(e.target.value)} placeholder="Ej. Moda que enamora, calidad que perdura" maxLength={80} />
          <label>Teléfono de contacto</label>
          <input type="text" value={telefonoInfo} onChange={e=>setTelefonoInfo(e.target.value)} placeholder="0000-0000" />
          <button className="btn btn-primary" disabled={guardandoInfo} onClick={guardarInfo}>
            {guardandoInfo ? 'Guardando…' : 'Guardar frase y teléfono'}
          </button>
        </div>

        <div className="form-card">
          <h3>{editingId ? 'Editar producto' : 'Agregar producto'}</h3>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            {fotosExistentes.map(url => (
              <div key={url} style={{ position:'relative', width:72, height:72, borderRadius:12, overflow:'hidden' }}>
                <img src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                <button type="button" onClick={()=>quitarFotoExistente(url)} style={{
                  position:'absolute', top:2, right:2, width:20, height:20, borderRadius:'50%', border:'none',
                  background:'rgba(23,22,42,0.7)', color:'#fff', fontSize:11, cursor:'pointer', lineHeight:1
                }}>✕</button>
              </div>
            ))}
            {fotosNuevasPreview.map((url, i) => (
              <div key={i} style={{ position:'relative', width:72, height:72, borderRadius:12, overflow:'hidden' }}>
                <img src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                <button type="button" onClick={()=>quitarFotoNueva(i)} style={{
                  position:'absolute', top:2, right:2, width:20, height:20, borderRadius:'50%', border:'none',
                  background:'rgba(23,22,42,0.7)', color:'#fff', fontSize:11, cursor:'pointer', lineHeight:1
                }}>✕</button>
              </div>
            ))}
            <div className="photo-upload" style={{ width:72, height:72, marginBottom:0 }}>
              <span className="hint" style={{ fontSize:10, textAlign:'center' }}>📷 Agregar<br/>foto</span>
              <input type="file" accept="image/*" multiple onChange={onFotosChange} />
            </div>
          </div>
          <p style={{ fontSize:11, color:'#57536B', marginTop:-6, marginBottom:6 }}>
            Podés subir una sola foto, o varias — tus compradores podrán verlas todas al ampliar.
          </p>
          <form onSubmit={guardar}>
            <div className="row2">
              <div style={{flex:1}}>
                <label>Código</label>
                <input type="text" value={form.codigo} onChange={e=>setForm({...form, codigo:e.target.value})} required />
              </div>
              <div style={{flex:1}}>
                <label>Precio (Q)</label>
                <input type="number" step="0.01" value={form.precio} onChange={e=>setForm({...form, precio:e.target.value})} required />
              </div>
            </div>
            <label>Nombre</label>
            <input type="text" value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} required />
            <label>Descripción</label>
            <textarea value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})} />
            <label>Existencias</label>
            <input type="number" value={form.existencia} onChange={e=>setForm({...form, existencia:e.target.value})} required />
            <label>Se vende por</label>
            <select value={form.unidad} onChange={e=>setForm({...form, unidad:e.target.value})}
              style={{width:'100%', border:'1.5px solid #EAE4D8', background:'#fff', borderRadius:10, padding:'10px 11px', fontFamily:"'Inter',sans-serif", fontSize:13.5, color:'#17162A'}}>
              <option value="unidad">Unidad</option>
              <option value="libra">Libra</option>
              <option value="docena">Docena</option>
              <option value="metro">Metro</option>
              <option value="par">Par</option>
              <option value="paquete">Paquete</option>
              <option value="hora">Hora</option>
              <option value="servicio">Servicio</option>
            </select>
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? 'Guardando…' : (editingId ? 'Actualizar producto' : 'Guardar producto')}
            </button>
            {editingId && <button type="button" className="btn" style={{marginTop:8, background:'#F1EDE4'}} onClick={resetForm}>Cancelar edición</button>}
          </form>
        </div>

        <div className="form-card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:13 }}>
              Plan {vendedor.plan === 'pro' ? 'Pro ✨' : 'Gratis'}
            </div>
            <div style={{ fontSize:11, color:'#57536B', marginTop:2 }}>
              {vendedor.plan === 'pro' ? 'Productos ilimitados' : `${productos.length} de ${LIMITE_PLAN_GRATIS} productos usados`}
            </div>
          </div>
          {vendedor.plan !== 'pro' && (
            <a href={linkWhatsapp(WHATSAPP_SOPORTE, `Hola, quiero pasar mi tienda "${vendedor.nombre_tienda}" al plan Pro de VendéLive`)} target="_blank" rel="noreferrer"
              style={{ fontSize:11, fontWeight:700, background:'#17162A', color:'#fff', padding:'7px 12px', borderRadius:999, textDecoration:'none' }}>
              Pasar a Pro
            </a>
          )}
        </div>

        <div className="section-title">Mis productos <span className="count-pill">{productos.length}</span></div>
        {productos.length === 0 && <div className="empty">Aún no agregás productos.</div>}
        {productos.map(p => (
          <div className="vcard" key={p.id}>
            {p.foto_url ? <img src={p.foto_url} /> : <div className="noimg">sin foto</div>}
            <div className="info">
              <div className="nombre">{p.nombre}</div>
              <span className="codigo">{p.codigo}</span>
              <div className="meta">
                Q{Number(p.precio).toFixed(2)}{p.unidad && p.unidad!=='unidad' ? ` / ${p.unidad}` : ''} · {p.existencia} und.
                <span className={`stock-badge ${p.existencia>0?'stock-ok':'stock-out'}`}>{p.existencia>0?'Disponible':'Agotado'}</span>
              </div>
            </div>
            <button className="icon-btn" title="Copiar link directo a este producto"
              onClick={()=>{
                navigator.clipboard.writeText(`${window.location.origin}/tienda/${vendedor.slug}?codigo=${p.codigo}`)
                mostrarToast('Link directo copiado')
              }}>🔗</button>
            <button className="icon-btn" onClick={()=>editar(p)}>✏️</button>
            <button className="icon-btn" onClick={()=>eliminar(p.id)}>🗑️</button>
          </div>
        ))}
        </>
        )}
      </main>
      <div className={`toast ${toast?'show':''}`}>{toast}</div>
    </div>
  )
}

// ============================================
// PANEL DE ADMINISTRADOR (solo para ti)
// ============================================
function AdminPanel() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modo, setModo] = useState('login') // login | registro
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [vendedores, setVendedores] = useState([])
  const [busquedaAdmin, setBusquedaAdmin] = useState('')
  const [filtroEstadoAdmin, setFiltroEstadoAdmin] = useState('todos')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session && session.user.email === ADMIN_EMAIL) cargar()
  }, [session])

  async function cargar() {
    const { data } = await supabase.from('vendedores').select('*').order('creado_en', { ascending:false })
    setVendedores(data || [])
  }

  async function loginAdmin(e) {
    e.preventDefault()
    setEntrando(true)
    setMsg('')
    if (modo === 'registro') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMsg(error.message)
      else setMsg('Cuenta creada. Ahora inicia sesión con ese mismo correo y contraseña.')
      setEntrando(false)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMsg(error.message)
    setEntrando(false)
  }

  async function cambiarEstado(id, nuevoEstado) {
    await supabase.from('vendedores').update({ estado: nuevoEstado }).eq('id', id)
    cargar()
  }

  async function cambiarPlan(id, nuevoPlan) {
    await supabase.from('vendedores').update({ plan: nuevoPlan }).eq('id', id)
    cargar()
  }

  const vendedoresFiltrados = vendedores.filter(v => {
    if (filtroEstadoAdmin !== 'todos' && v.estado !== filtroEstadoAdmin) return false
    if (busquedaAdmin) {
      const q = busquedaAdmin.toLowerCase()
      const enNombre = v.nombre_tienda?.toLowerCase().includes(q)
      const enCorreo = v.correo?.toLowerCase().includes(q)
      const enSlug = v.slug?.toLowerCase().includes(q)
      if (!enNombre && !enCorreo && !enSlug) return false
    }
    return true
  })

  const contadorEstados = {
    pendiente: vendedores.filter(v=>v.estado==='pendiente').length,
    activo: vendedores.filter(v=>v.estado==='activo').length,
    suspendido: vendedores.filter(v=>v.estado==='suspendido').length,
  }

  if (loading) return <PantallaCarga />

  if (!session) {
    return (
      <div className="phone">
        <header className="hero">
          <span className="live-badge"><span className="dot"></span>Admin</span>
          <h1 className="brand">Vendé<span>Live</span></h1>
          <p className="tagline">Acceso de administrador</p>
        </header>
        <main>
          <div className="form-card">
            <h3>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta de administrador'}</h3>
            <form onSubmit={loginAdmin}>
              <label>Correo</label>
              <input type="text" value={email} onChange={e=>setEmail(e.target.value)} required />
              <label>Contraseña</label>
              <CampoClave value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña" />
              {msg && <p style={{fontSize:12, color: msg.includes('Cuenta creada') ? '#1FAE7C' : '#D62A48', marginTop:10}}>{msg}</p>}
              <button className="btn btn-primary" disabled={entrando} type="submit">
                {entrando ? 'Un momento…' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            </form>
            <p style={{fontSize:12, marginTop:10, textAlign:'center', color:'#57536B'}}>
              {modo === 'login' ? '¿Primera vez con esta cuenta de admin?' : '¿Ya tienes cuenta?'}{' '}
              <span style={{color:'#FF3B5C', fontWeight:600, cursor:'pointer'}}
                onClick={()=>{ setModo(modo==='login'?'registro':'login'); setMsg('') }}>
                {modo === 'login' ? 'Créala aquí' : 'Inicia sesión'}
              </span>
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return <div className="phone"><div className="empty" style={{paddingTop:100}}>No autorizado.</div></div>
  }

  return (
    <div className="phone">
      <header className="hero">
        <span className="live-badge"><span className="dot"></span>Admin</span>
        <h1 className="brand">Vendé<span>Live</span></h1>
        <p className="tagline">Panel de administrador</p>
        <p style={{fontSize:11.5, marginTop:10, cursor:'pointer', color:'#B8B4C9', textDecoration:'underline'}}
          onClick={()=>supabase.auth.signOut()}>
          Cerrar sesión
        </p>
      </header>
      <main>
        <div className="form-card">
          <input type="text" value={busquedaAdmin} onChange={e=>setBusquedaAdmin(e.target.value)}
            placeholder="Buscar por tienda, correo o link" />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
            {[
              ['todos', `Todos (${vendedores.length})`],
              ['pendiente', `Pendientes (${contadorEstados.pendiente})`],
              ['activo', `Activos (${contadorEstados.activo})`],
              ['suspendido', `Suspendidos (${contadorEstados.suspendido})`],
            ].map(([key,label]) => (
              <button key={key} type="button" onClick={()=>setFiltroEstadoAdmin(key)} style={{
                fontSize:11, fontWeight:600, padding:'6px 10px', borderRadius:999, cursor:'pointer',
                border: filtroEstadoAdmin===key ? '1px solid #17162A' : '1px solid #EAE4D8',
                background: filtroEstadoAdmin===key ? '#17162A' : '#F1EDE4',
                color: filtroEstadoAdmin===key ? '#fff' : '#17162A'
              }}>{label}</button>
            ))}
          </div>
        </div>

        <div className="section-title">Tiendas <span className="count-pill">{vendedoresFiltrados.length}</span></div>
        {vendedoresFiltrados.map(v => (
          <div className="form-card" key={v.id}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
              <Avatar nombre={v.nombre_tienda} logo_url={v.logo_url} size={36} />
              <div style={{flex:1}}>
                <div style={{fontWeight:700, fontSize:14}}>{v.nombre_tienda}</div>
                <div style={{fontSize:11.5, color:'#57536B'}}>{v.correo}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                <span style={{
                  fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999, textTransform:'uppercase',
                  background: v.estado==='activo' ? '#E4F6EF' : v.estado==='suspendido' ? '#FDE3E7' : '#FDE9CC',
                  color: v.estado==='activo' ? '#1FAE7C' : v.estado==='suspendido' ? '#D62A48' : '#B5750B'
                }}>{v.estado}</span>
                <span style={{
                  fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999,
                  background: v.plan==='pro' ? '#FFF3D6' : '#F1EDE4',
                  color: v.plan==='pro' ? '#B5750B' : '#57536B'
                }}>{v.plan==='pro' ? 'PRO ✨' : 'GRATIS'}</span>
              </div>
            </div>
            <div style={{fontSize:11.5, color:'#57536B', marginBottom:10}}>
              Tel: {v.telefono || '—'} · /tienda/{v.slug}
            </div>
            <div className="row2">
              <button className="btn" style={{background: v.estado==='activo' ? '#1FAE7C' : '#F1EDE4', color: v.estado==='activo' ? '#fff' : '#17162A'}}
                onClick={()=>cambiarEstado(v.id, 'activo')}>Activar</button>
              <button className="btn" style={{background: v.estado==='suspendido' ? '#D62A48' : '#F1EDE4', color: v.estado==='suspendido' ? '#fff' : '#17162A'}}
                onClick={()=>cambiarEstado(v.id, 'suspendido')}>Suspender</button>
            </div>
            <div className="row2" style={{marginTop:8}}>
              <button className="btn" style={{background: v.plan!=='pro' ? '#17162A' : '#F1EDE4', color: v.plan!=='pro' ? '#fff' : '#17162A'}}
                onClick={()=>cambiarPlan(v.id, 'gratis')}>Plan Gratis</button>
              <button className="btn" style={{background: v.plan==='pro' ? '#FFB627' : '#F1EDE4', color: v.plan==='pro' ? '#17162A' : '#17162A'}}
                onClick={()=>cambiarPlan(v.id, 'pro')}>Plan Pro ✨</button>
            </div>
          </div>
        ))}
        {vendedoresFiltrados.length === 0 && <div className="empty">No hay tiendas que coincidan con la búsqueda.</div>}
      </main>
    </div>
  )
}
function TiendaPublica({ slug }) {
  const [vendedor, setVendedor] = useState(undefined)
  const [productos, setProductos] = useState([])
  const [indice, setIndice] = useState(0)
  const [carrito, setCarrito] = useState([]) // [{producto, cantidad}]
  const [vistaCarrito, setVistaCarrito] = useState(null) // null | 'carrito' | 'datos'
  const [zoomGaleria, setZoomGaleria] = useState(null) // { fotos: string[], index: number } | null
  const [buyer, setBuyer] = useState({ nombre:'', telefono:'', direccion:'', observacion:'' })
  const [toast, setToast] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [codigoBuscado, setCodigoBuscado] = useState('')

  useEffect(() => {
    supabase.from('vendedores').select('*').eq('slug', slug).eq('estado','activo').maybeSingle()
      .then(({ data }) => setVendedor(data))
  }, [slug])

  useEffect(() => {
    if (!vendedor) return
    cargarProductos()
  }, [vendedor])

  useEffect(() => {
    if (productos.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const codigoUrl = params.get('codigo')
    if (codigoUrl) {
      const pos = productos.findIndex(p => p.codigo.toLowerCase() === codigoUrl.toLowerCase())
      if (pos >= 0) setIndice(pos)
    }
  }, [productos])

  function buscarPorCodigo(e) {
    e.preventDefault()
    if (!codigoBuscado.trim()) return
    const pos = productos.findIndex(p => p.codigo.toLowerCase() === codigoBuscado.trim().toLowerCase())
    if (pos >= 0) {
      setIndice(pos)
      mostrarToast(`Mostrando: ${productos[pos].nombre}`)
    } else {
      mostrarToast('⚠️ No encontramos ese código')
    }
    setCodigoBuscado('')
  }

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('*').eq('vendedor_id', vendedor.id).order('creado_en', { ascending:false })
    setProductos(data || [])
  }

  function mostrarToast(m) { setToast(m); setTimeout(()=>setToast(''), 2500) }

  function cantidadEnCarrito(id) {
    const item = carrito.find(c => c.producto.id === id)
    return item ? item.cantidad : 0
  }

  function agregarAlCarrito(p) {
    const yaEnCarrito = cantidadEnCarrito(p.id)
    if (yaEnCarrito >= p.existencia) { mostrarToast('⚠️ No hay más existencia de este producto'); return }
    setCarrito(c => {
      const existe = c.find(item => item.producto.id === p.id)
      if (existe) return c.map(item => item.producto.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      return [...c, { producto: p, cantidad: 1 }]
    })
    mostrarToast(`${p.nombre} agregado al carrito`)
  }

  function cambiarCantidad(id, delta) {
    setCarrito(c => c.map(item => {
      if (item.producto.id !== id) return item
      const nueva = Math.min(item.producto.existencia, Math.max(1, item.cantidad + delta))
      return { ...item, cantidad: nueva }
    }))
  }

  function quitarDelCarrito(id) {
    setCarrito(c => c.filter(item => item.producto.id !== id))
  }

  const totalItems = carrito.reduce((n, i) => n + i.cantidad, 0)
  const totalCarrito = carrito.reduce((n, i) => n + i.cantidad * Number(i.producto.precio), 0)

  async function confirmarCompra() {
    if (!buyer.nombre || !buyer.telefono || !buyer.direccion) {
      mostrarToast('⚠️ Completá nombre, teléfono y dirección'); return
    }
    setConfirming(true)
    const grupoId = crypto.randomUUID()
    for (const item of carrito) {
      const { error } = await supabase.rpc('comprar_producto', {
        p_producto_id: item.producto.id,
        p_cantidad: item.cantidad,
        p_nombre: buyer.nombre,
        p_telefono: buyer.telefono,
        p_direccion: buyer.direccion,
        p_observacion: buyer.observacion,
        p_grupo_pedido: grupoId
      })
      if (error) {
        setConfirming(false)
        mostrarToast('⚠️ ' + error.message)
        cargarProductos()
        return
      }
    }
    setConfirming(false)
    mostrarToast(`Pedido confirmado — ${totalItems} producto(s)`)
    setCarrito([])
    setVistaCarrito(null)
    cargarProductos()
  }

  if (vendedor === undefined) return <PantallaCarga />
  if (vendedor === null) return <div className="phone"><div className="empty" style={{paddingTop:100}}>Esta tienda no existe o no está disponible.</div></div>

  return (
    <div className="phone">
      <header className="hero">
        <div style={{textAlign:'center'}}>
          <span className="live-badge"><span className="dot"></span>En vivo</span>
          <div style={{marginTop:14}}>
            <Avatar nombre={vendedor.nombre_tienda} logo_url={vendedor.logo_url} size={76} />
          </div>
          <h1 style={{fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:700, marginTop:10, color:'#fff'}}>{vendedor.nombre_tienda}</h1>
          <p style={{fontSize:14.5, color:'#D9D5EA', marginTop:3, fontWeight:500}}>{vendedor.frase || 'Catálogo'}</p>
          {vendedor.telefono && (
            <a href={linkWhatsapp(vendedor.telefono, `Hola, vengo de tu catálogo ${vendedor.nombre_tienda} 👋`)} target="_blank" rel="noreferrer" style={{
              display:'inline-flex', alignItems:'center', gap:6, marginTop:10,
              background:'rgba(37,211,102,0.18)', border:'1px solid rgba(37,211,102,0.4)', padding:'6px 14px', borderRadius:999,
              fontSize:12.5, color:'#fff', textDecoration:'none', fontWeight:600
            }}>💬 Escribinos por WhatsApp</a>
          )}
        </div>
      </header>
      <main>
        {productos.length > 1 && (
          <form onSubmit={buscarPorCodigo} style={{ display:'flex', gap:8, marginBottom:14 }}>
            <input type="text" value={codigoBuscado} onChange={e=>setCodigoBuscado(e.target.value)}
              placeholder="¿Te dieron un código en vivo? Escríbelo aquí" style={{ flex:1 }} />
            <button type="submit" className="btn" style={{ width:'auto', padding:'0 16px', background:'#17162A', color:'#fff' }}>Ir</button>
          </form>
        )}
        {productos.length === 0 && <div className="empty">Todavía no hay productos.</div>}
        {productos.length > 0 && (() => {
          const p = productos[indice]
          const enCarrito = cantidadEnCarrito(p.id)
          const irAnterior = () => setIndice(i => (i - 1 + productos.length) % productos.length)
          const irSiguiente = () => setIndice(i => (i + 1) % productos.length)
          return (
            <div>
              <div style={{ position:'relative' }}>
                <div className="pcard" style={{ width:'100%' }}>
                  <div className="imgwrap" style={{ height:260, cursor: p.foto_url ? 'zoom-in' : 'default' }}
                    onClick={()=>{
                      const galeria = (p.fotos && p.fotos.length > 0) ? p.fotos : (p.foto_url ? [p.foto_url] : [])
                      if (galeria.length > 0) setZoomGaleria({ fotos: galeria, index: 0 })
                    }}>
                    {p.foto_url && <img src={p.foto_url} />}
                    {p.foto_url && (
                      <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(23,22,42,0.6)', color:'#fff', fontSize:10.5, padding:'3px 8px', borderRadius:999, fontWeight:600 }}>
                        🔍 {p.fotos && p.fotos.length > 1 ? `Ver ${p.fotos.length} fotos` : 'Toca para ampliar'}
                      </div>
                    )}
                    {p.existencia === 0 && <div className="agotado-tag">AGOTADO</div>}
                  </div>
                  <div className="body" style={{ padding:16, gap:8 }}>
                    <span className="codigo" style={{ fontSize:11.5 }}>{p.codigo}</span>
                    <div className="nombre" style={{ fontSize:17 }}>{p.nombre}</div>
                    {p.descripcion && <div style={{ fontSize:12.5, color:'#57536B' }}>{p.descripcion}</div>}
                    <span className="precio" style={{ fontSize:16, padding:'4px 12px' }}>Q{Number(p.precio).toFixed(2)}{p.unidad && p.unidad!=='unidad' ? ` / ${p.unidad}` : ''}</span>
                    <span className="exist" style={{ fontSize:12 }}>{p.existencia>0 ? p.existencia+' disponibles' : 'Sin existencias'}</span>
                    <button className="btn btn-live" disabled={p.existencia===0 || enCarrito >= p.existencia} onClick={()=>agregarAlCarrito(p)}>
                      <span className="dot"></span>
                      {p.existencia===0 ? 'Agotado' : enCarrito > 0 ? `En el carrito (${enCarrito}) · Agregar otro` : 'Agregar al carrito'}
                    </button>
                  </div>
                </div>

                {productos.length > 1 && (
                  <>
                    <button onClick={irAnterior} aria-label="Producto anterior" style={{
                      position:'absolute', left:8, top:110, transform:'translateY(-50%)',
                      width:38, height:38, borderRadius:'50%', border:'none', cursor:'pointer',
                      background:'rgba(23,22,42,0.55)', color:'#fff', fontSize:18, display:'flex',
                      alignItems:'center', justifyContent:'center'
                    }}>‹</button>
                    <button onClick={irSiguiente} aria-label="Siguiente producto" style={{
                      position:'absolute', right:8, top:110, transform:'translateY(-50%)',
                      width:38, height:38, borderRadius:'50%', border:'none', cursor:'pointer',
                      background:'rgba(23,22,42,0.55)', color:'#fff', fontSize:18, display:'flex',
                      alignItems:'center', justifyContent:'center'
                    }}>›</button>
                  </>
                )}
              </div>

              {productos.length > 1 && (
                <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:14 }}>
                  {productos.map((_, i) => (
                    <div key={i} onClick={()=>setIndice(i)} style={{
                      width: i===indice ? 18 : 7, height:7, borderRadius:999, cursor:'pointer',
                      background: i===indice ? '#FF3B5C' : '#C9C2B4', transition:'width 0.2s'
                    }} />
                  ))}
                </div>
              )}
              <p style={{ textAlign:'center', fontSize:11.5, color:'#57536B', marginTop:8 }}>
                {indice+1} de {productos.length}
              </p>
            </div>
          )
        })()}
      </main>

      {totalItems > 0 && !vistaCarrito && (
        <div style={{ position:'sticky', bottom:14, display:'flex', justifyContent:'center', padding:'0 20px' }}>
          <button className="btn btn-live" style={{ width:'100%', maxWidth:390, boxShadow:'0 10px 25px rgba(255,59,92,0.35)' }}
            onClick={()=>setVistaCarrito('carrito')}>
            🛒 Ver carrito ({totalItems}) · Q{totalCarrito.toFixed(2)}
          </button>
        </div>
      )}

      {vistaCarrito === 'carrito' && (
        <div className="overlay active" onClick={e=>{ if(e.target.className.includes('overlay')) setVistaCarrito(null) }}>
          <div className="sheet">
            <h3>Tu carrito</h3>
            <div className="sub">{totalItems} producto(s)</div>
            {carrito.map(item => (
              <div key={item.producto.id} className="vcard">
                {item.producto.foto_url ? <img src={item.producto.foto_url} /> : <div className="noimg">sin foto</div>}
                <div className="info">
                  <div className="nombre">{item.producto.nombre}</div>
                  <div className="meta">Q{Number(item.producto.precio).toFixed(2)}{item.producto.unidad && item.producto.unidad!=='unidad' ? ` / ${item.producto.unidad}` : ' c/u'}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                    <button onClick={()=>cambiarCantidad(item.producto.id,-1)} style={{width:24,height:24,borderRadius:7,border:'none',background:'#F1EDE4',fontWeight:700,cursor:'pointer'}}>–</button>
                    <span style={{fontWeight:700, fontSize:13}}>{item.cantidad}</span>
                    <button onClick={()=>cambiarCantidad(item.producto.id,1)} style={{width:24,height:24,borderRadius:7,border:'none',background:'#F1EDE4',fontWeight:700,cursor:'pointer'}}>+</button>
                  </div>
                </div>
                <button className="icon-btn" onClick={()=>quitarDelCarrito(item.producto.id)}>🗑️</button>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>
              <span>Total</span>
              <span>Q{totalCarrito.toFixed(2)}</span>
            </div>
            <button className="btn btn-live" onClick={()=>setVistaCarrito('datos')}>
              <span className="dot"></span>Continuar con mis datos
            </button>
          </div>
        </div>
      )}

      {vistaCarrito === 'datos' && (
        <div className="overlay active" onClick={e=>{ if(e.target.className.includes('overlay')) setVistaCarrito(null) }}>
          <div className="sheet">
            <p style={{fontSize:12, color:'#FF3B5C', fontWeight:600, cursor:'pointer', marginBottom:4}}
              onClick={()=>setVistaCarrito('carrito')}>‹ Volver al carrito</p>
            <h3>Tus datos de envío</h3>
            <div className="sub">{totalItems} producto(s) · Q{totalCarrito.toFixed(2)}</div>
            <label>Nombre completo</label>
            <input type="text" value={buyer.nombre} onChange={e=>setBuyer({...buyer, nombre:e.target.value})} />
            <label>Teléfono</label>
            <input type="text" value={buyer.telefono} onChange={e=>setBuyer({...buyer, telefono:e.target.value})} />
            <label>Dirección de envío</label>
            <input type="text" value={buyer.direccion} onChange={e=>setBuyer({...buyer, direccion:e.target.value})} />
            <label>Observación (opcional)</label>
            <textarea value={buyer.observacion} onChange={e=>setBuyer({...buyer, observacion:e.target.value})} />
            <button className="btn btn-live" disabled={confirming} onClick={confirmarCompra}>
              <span className="dot"></span>{confirming ? 'Confirmando…' : 'Confirmar pedido'}
            </button>
          </div>
        </div>
      )}

      {zoomGaleria && (() => {
        const { fotos, index } = zoomGaleria
        const anterior = e => { e.stopPropagation(); setZoomGaleria(z => ({ ...z, index: (z.index - 1 + fotos.length) % fotos.length })) }
        const siguiente = e => { e.stopPropagation(); setZoomGaleria(z => ({ ...z, index: (z.index + 1) % fotos.length })) }
        return (
          <div onClick={()=>setZoomGaleria(null)} style={{
            position:'fixed', inset:0, background:'rgba(10,9,20,0.92)', zIndex:50,
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out', padding:20
          }}>
            <img src={fotos[index]} style={{ maxWidth:'100%', maxHeight:'100%', borderRadius:12, objectFit:'contain' }} />
            <button onClick={()=>setZoomGaleria(null)} aria-label="Cerrar" style={{
              position:'absolute', top:18, right:18, width:36, height:36, borderRadius:'50%',
              border:'none', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:18, cursor:'pointer'
            }}>✕</button>

            {fotos.length > 1 && (
              <>
                <button onClick={anterior} aria-label="Foto anterior" style={{
                  position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
                  width:42, height:42, borderRadius:'50%', border:'none', cursor:'pointer',
                  background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:20
                }}>‹</button>
                <button onClick={siguiente} aria-label="Foto siguiente" style={{
                  position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                  width:42, height:42, borderRadius:'50%', border:'none', cursor:'pointer',
                  background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:20
                }}>›</button>
                <div onClick={e=>e.stopPropagation()} style={{
                  position:'absolute', bottom:22, left:'50%', transform:'translateX(-50%)',
                  display:'flex', gap:6
                }}>
                  {fotos.map((_, i) => (
                    <div key={i} onClick={()=>setZoomGaleria(z=>({...z, index:i}))} style={{
                      width: i===index ? 16 : 6, height:6, borderRadius:999, cursor:'pointer',
                      background: i===index ? '#FF3B5C' : 'rgba(255,255,255,0.4)', transition:'width 0.2s'
                    }} />
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}
      <div className={`toast ${toast?'show':''}`}>{toast}</div>
    </div>
  )
}
