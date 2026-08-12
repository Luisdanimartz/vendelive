import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './App.css'

function slugify(text) {
  return text
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
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
        </div>
      </main>
    </div>
  )
}

// ============================================
// PANEL DEL VENDEDOR
// ============================================
function PanelVendedor({ vendedor, setVendedor }) {
  const [productos, setProductos] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [foto, setFoto] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [form, setForm] = useState({ codigo:'', nombre:'', descripcion:'', precio:'', existencia:'' })
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [logoNuevo, setLogoNuevo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(vendedor.logo_url)
  const [guardandoLogo, setGuardandoLogo] = useState(false)

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('*').eq('vendedor_id', vendedor.id).order('creado_en', { ascending:false })
    setProductos(data || [])
  }
  useEffect(() => { cargarProductos() }, [])

  function mostrarToast(m) {
    setToast(m)
    setTimeout(()=>setToast(''), 2200)
  }

  function resetForm() {
    setEditingId(null)
    setForm({ codigo:'', nombre:'', descripcion:'', precio:'', existencia:'' })
    setFoto(null)
    setFotoPreview(null)
  }

  function editar(p) {
    setEditingId(p.id)
    setForm({ codigo:p.codigo, nombre:p.nombre, descripcion:p.descripcion||'', precio:p.precio, existencia:p.existencia })
    setFotoPreview(p.foto_url)
    setFoto(null)
  }

  async function eliminar(id) {
    await supabase.from('productos').delete().eq('id', id)
    mostrarToast('Producto eliminado')
    cargarProductos()
  }

  async function guardar(e) {
    e.preventDefault()
    setSaving(true)
    let foto_url = fotoPreview
    if (foto) {
      const nombreArchivo = `${vendedor.id}/${Date.now()}-${foto.name}`
      const { error: upErr } = await supabase.storage.from('productos').upload(nombreArchivo, foto)
      if (!upErr) {
        const { data } = supabase.storage.from('productos').getPublicUrl(nombreArchivo)
        foto_url = data.publicUrl
      }
    }
    const payload = {
      vendedor_id: vendedor.id,
      codigo: form.codigo,
      nombre: form.nombre,
      descripcion: form.descripcion,
      precio: parseFloat(form.precio),
      existencia: parseInt(form.existencia),
      foto_url
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

  function onFotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setFoto(file)
    const reader = new FileReader()
    reader.onload = ev => setFotoPreview(ev.target.result)
    reader.readAsDataURL(file)
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

  const link = `${window.location.origin}/tienda/${vendedor.slug}`

  return (
    <div className="phone">
      <header className="hero">
        <span className="live-badge"><span className="dot"></span>En vivo</span>
        <h1 className="brand">Vendé<span>Live</span></h1>
        <div className="store-chip" style={{display:'inline-flex', alignItems:'center', gap:8}}>
          <Avatar nombre={vendedor.nombre_tienda} logo_url={vendedor.logo_url} size={18} />
          <span>{vendedor.nombre_tienda}</span>
        </div>
        <p style={{fontSize:11.5, marginTop:10, cursor:'pointer', color:'#B8B4C9', textDecoration:'underline'}}
          onClick={()=>supabase.auth.signOut()}>
          Cerrar sesión
        </p>
      </header>
      <main>
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
        </div>

        <div className="form-card">
          <h3>{editingId ? 'Editar producto' : 'Agregar producto'}</h3>
          <div className="photo-upload">
            {fotoPreview ? <img src={fotoPreview} /> : <span className="hint">📷 Tocá para subir foto</span>}
            <input type="file" accept="image/*" onChange={onFotoChange} />
          </div>
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
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? 'Guardando…' : (editingId ? 'Actualizar producto' : 'Guardar producto')}
            </button>
            {editingId && <button type="button" className="btn" style={{marginTop:8, background:'#F1EDE4'}} onClick={resetForm}>Cancelar edición</button>}
          </form>
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
                Q{Number(p.precio).toFixed(2)} · {p.existencia} und.
                <span className={`stock-badge ${p.existencia>0?'stock-ok':'stock-out'}`}>{p.existencia>0?'Disponible':'Agotado'}</span>
              </div>
            </div>
            <button className="icon-btn" onClick={()=>editar(p)}>✏️</button>
            <button className="icon-btn" onClick={()=>eliminar(p.id)}>🗑️</button>
          </div>
        ))}
      </main>
      <div className={`toast ${toast?'show':''}`}>{toast}</div>
    </div>
  )
}

// ============================================
// PANEL DE ADMINISTRADOR (solo para ti)
// ============================================
const ADMIN_EMAIL = 'luismartz23@gmail.com'

function AdminPanel() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modo, setModo] = useState('login') // login | registro
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [vendedores, setVendedores] = useState([])

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
        <div className="section-title">Tiendas registradas <span className="count-pill">{vendedores.length}</span></div>
        {vendedores.map(v => (
          <div className="form-card" key={v.id}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
              <Avatar nombre={v.nombre_tienda} logo_url={v.logo_url} size={36} />
              <div>
                <div style={{fontWeight:700, fontSize:14}}>{v.nombre_tienda}</div>
                <div style={{fontSize:11.5, color:'#57536B'}}>{v.correo}</div>
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
            <p style={{fontSize:11, marginTop:8, color:'#57536B'}}>Estado actual: <strong>{v.estado}</strong></p>
          </div>
        ))}
        {vendedores.length === 0 && <div className="empty">Aún no hay tiendas registradas.</div>}
      </main>
    </div>
  )
}
function TiendaPublica({ slug }) {
  const [vendedor, setVendedor] = useState(undefined)
  const [productos, setProductos] = useState([])
  const [buyProduct, setBuyProduct] = useState(null)
  const [qty, setQty] = useState(1)
  const [buyer, setBuyer] = useState({ nombre:'', telefono:'', direccion:'', observacion:'' })
  const [toast, setToast] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    supabase.from('vendedores').select('*').eq('slug', slug).eq('estado','activo').maybeSingle()
      .then(({ data }) => setVendedor(data))
  }, [slug])

  useEffect(() => {
    if (!vendedor) return
    cargarProductos()
  }, [vendedor])

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('*').eq('vendedor_id', vendedor.id).order('creado_en', { ascending:false })
    setProductos(data || [])
  }

  function mostrarToast(m) { setToast(m); setTimeout(()=>setToast(''), 2500) }

  function abrirCompra(p) {
    setBuyProduct(p)
    setQty(1)
    setBuyer({ nombre:'', telefono:'', direccion:'', observacion:'' })
  }

  async function confirmarCompra() {
    if (!buyer.nombre || !buyer.telefono || !buyer.direccion) {
      mostrarToast('⚠️ Completá nombre, teléfono y dirección'); return
    }
    setConfirming(true)
    const { error } = await supabase.rpc('comprar_producto', {
      p_producto_id: buyProduct.id,
      p_cantidad: qty,
      p_nombre: buyer.nombre,
      p_telefono: buyer.telefono,
      p_direccion: buyer.direccion,
      p_observacion: buyer.observacion
    })
    setConfirming(false)
    if (error) { mostrarToast('⚠️ ' + error.message); return }
    mostrarToast(`Pedido confirmado — ${buyProduct.nombre} x${qty}`)
    setBuyProduct(null)
    cargarProductos()
  }

  if (vendedor === undefined) return <PantallaCarga />
  if (vendedor === null) return <div className="phone"><div className="empty" style={{paddingTop:100}}>Esta tienda no existe o no está disponible.</div></div>

  return (
    <div className="phone">
      <header className="hero">
        <span className="live-badge"><span className="dot"></span>En vivo</span>
        <div style={{marginTop:10}}>
          <Avatar nombre={vendedor.nombre_tienda} logo_url={vendedor.logo_url} size={44} />
        </div>
        <h1 className="brand" style={{marginTop:8}}>{vendedor.nombre_tienda}</h1>
        <p className="tagline">Catálogo en vivo</p>
      </header>
      <main>
        <div className="grid">
          {productos.map(p => (
            <div className="pcard" key={p.id}>
              <div className="imgwrap">
                {p.foto_url && <img src={p.foto_url} />}
                {p.existencia === 0 && <div className="agotado-tag">AGOTADO</div>}
              </div>
              <div className="body">
                <span className="codigo">{p.codigo}</span>
                <div className="nombre">{p.nombre}</div>
                <span className="precio">Q{Number(p.precio).toFixed(2)}</span>
                <span className="exist">{p.existencia>0 ? p.existencia+' disponibles' : 'Sin existencias'}</span>
                <button className="btn btn-live" disabled={p.existencia===0} onClick={()=>abrirCompra(p)}>
                  <span className="dot"></span>{p.existencia===0?'Agotado':'Comprar'}
                </button>
              </div>
            </div>
          ))}
          {productos.length===0 && <div className="empty" style={{gridColumn:'1/-1'}}>Todavía no hay productos.</div>}
        </div>
      </main>

      {buyProduct && (
        <div className="overlay active" onClick={e=>{ if(e.target.className.includes('overlay')) setBuyProduct(null) }}>
          <div className="sheet">
            <h3>{buyProduct.nombre}</h3>
            <div className="sub">Q{Number(buyProduct.precio).toFixed(2)} · Código {buyProduct.codigo}</div>
            <div className="qty-row">
              <span style={{fontSize:12.5, fontWeight:600}}>Cantidad</span>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <button onClick={()=>setQty(q=>Math.max(1,q-1))}>–</button>
                <span style={{fontWeight:700}}>{qty}</span>
                <button onClick={()=>setQty(q=>Math.min(buyProduct.existencia,q+1))}>+</button>
              </div>
            </div>
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
      <div className={`toast ${toast?'show':''}`}>{toast}</div>
    </div>
  )
}
