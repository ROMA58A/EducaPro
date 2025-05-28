let apiBaseUrl = '';

async function cargarConfiguracion() {
  try {
    const response = await fetch('config.xml');
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    apiBaseUrl = xmlDoc.getElementsByTagName('apiBaseUrl')[0].textContent;
    console.log('API base URL cargada:', apiBaseUrl);
  } catch (err) {
    console.error('Error al cargar configuración:', err);
    alert('No se pudo cargar la configuración del sistema.');
  }
}

async function cargarPerfil() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    document.getElementById('perfilNombre').textContent = data.name || 'Sin nombre';
    document.getElementById('perfilEmail').textContent = data.email || 'Sin correo';
    const rol = data.rol;
    document.getElementById('perfilRol').textContent = rol === '1' ? 'Profesor' : 'Alumno';

    if (rol === '0') {
      cargarMaterias();
      cargarCalificaciones();
    }

    document.title = `Sistema ${rol === '1' ? 'Profesor' : 'Alumno'}`;
  } catch (err) {
    console.error('Error perfil:', err);
  }
}

async function cargarMaterias() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/subjects`);
console.log('Cargando materias desde:', `${apiBaseUrl}/api/subjects`);
    const data = await response.json();

    if (!response.ok) {
      alert(`Error al cargar las materias: ${data.message || 'Error desconocido'}`);
      return;
    }

    const container = document.getElementById('materiasContainer');
    container.innerHTML = '';

    data.subjects.forEach((materia) => {
      const card = document.createElement('div');
      card.className = 'col-md-4 mb-4';

      card.innerHTML = `
        <div class="card shadow">
          <div class="card-body">
            <h5 class="card-title">${materia.name}</h5>
            <p class="card-text">${materia.description}</p>
            <div class="d-flex justify-content-between">
              <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#materiaModal"
                onclick='verDetalles(${JSON.stringify(materia)})'>
                Ver más
              </button>
              <button class="btn btn-success" onclick="inscribirseMateria(${materia.id})">
                Inscribirse
              </button>
            </div>
            <div class="mt-3" id="mensaje-${materia.id}"></div>
          </div>
        </div>`;

      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error al cargar materias:', err);
    alert('Ocurrió un error al intentar cargar las materias.');
  }
}

async function inscribirseMateria(subjectId) {
  try {
    const usuarioActualId = localStorage.getItem('userId');
    const response = await fetch(`${apiBaseUrl}/api/inscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id: subjectId, user_id: usuarioActualId })
    });

    const mensajeDiv = document.getElementById(`mensaje-${subjectId}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Detalle error:', errorData);

      if (errorData.errors && errorData.errors.includes("Ya estás inscrito a esta materia")) {
        mensajeDiv.innerHTML = `<div class="alert alert-info">Ya se inscribió 👍</div>`;
      } else {
        mensajeDiv.innerHTML = `<div class="alert alert-danger">Error al inscribirse: ${errorData.message || JSON.stringify(errorData)}</div>`;
      }
      return;
    }

    mensajeDiv.innerHTML = `<div class="alert alert-success">Inscripción exitosa 👍</div>`;
  } catch (error) {
    console.error('Error al inscribirse:', error);
    const mensajeDiv = document.getElementById(`mensaje-${subjectId}`);
    mensajeDiv.innerHTML = `<div class="alert alert-danger">Ocurrió un error al intentar inscribirse.</div>`;
  }
}


async function cargarCalificaciones() {
  try {
   const token = localStorage.getItem('token');
   const userId = localStorage.getItem('userId');
   if (!token || !userId) return;

   const container = document.getElementById('calificacionesContainer');
   // Muestra un mensaje de carga mientras se actualizan las calificaciones
   container.innerHTML = '<div>Actualizando calificaciones...</div>';

   // Realiza la petición para obtener las calificaciones del usuario
   const response = await fetch(`${apiBaseUrl}/api/grades/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
   });

   console.log('Cargando calificaciones desde:', `${apiBaseUrl}/api/grades/${userId}`);

   const data = await response.json();
   console.log(data); // Para depuración, muestra la respuesta de la API

   // Verifica si hay calificaciones disponibles
   if (!data.data || data.data.length === 0) {
    container.innerHTML = '<div>No hay calificaciones disponibles</div>';
    return;
   }

   // Limpia el contenedor antes de agregar las nuevas tarjetas
   container.innerHTML = '';

   // Agrupa las calificaciones por ID de materia
   const calificacionesAgrupadas = data.data.reduce((acc, calificacion) => {
    if (!acc[calificacion.subject_id]) acc[calificacion.subject_id] = [];
    acc[calificacion.subject_id].push(calificacion);
    return acc;
   }, {});

   // Obtenemos los detalles de las materias para mostrar el nombre
   const subjectDetails = {};
   for (const subjectId in calificacionesAgrupadas) {
    try {
     const responseSubject = await fetch(`${apiBaseUrl}/api/subjects/${subjectId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
     });
     const dataSubject = await responseSubject.json();
     if (dataSubject.data) {
      subjectDetails[subjectId] = dataSubject.data;
     }
    } catch (error) {
     console.error(`Error al obtener detalles de la materia ${subjectId}:`, error);
     // Fallback en caso de error al obtener el nombre de la materia
     subjectDetails[subjectId] = { name: `Materia ID: ${subjectId}` };
    }
   }

   // Itera sobre las materias agrupadas para crear las tarjetas
   for (const subjectId in calificacionesAgrupadas) {
    const calificacionesDeMateria = calificacionesAgrupadas[subjectId];
    // Ordena las calificaciones por la fecha más reciente (updated_at si existe, sino created_at)
    calificacionesDeMateria.sort((a, b) => {
     const dateA = a.updated_at ? new Date(a.updated_at) : new Date(a.created_at);
     const dateB = b.updated_at ? new Date(b.updated_at) : new Date(b.created_at);
     return dateB - dateA;
    });
    const ultimaCalificacion = calificacionesDeMateria[0]; // La calificación más reciente

    // Obtiene el nombre de la materia de los detalles previamente cargados
    const subjectName = subjectDetails[subjectId]?.name || `Materia ID: ${subjectId}`;

    const card = document.createElement('div');
    card.className = 'col-md-4 mb-4';
    card.innerHTML = `
      <div class="card shadow">
        <div class="card-body">
          <h5 class="card-title">${subjectName}</h5>
          <p class="card-text">Revisa tus calificaciones</p>
          <button class="btn btn-info" onclick="mostrarDetallesMateria(${subjectId}, '${ultimaCalificacion.grade}')">Ver detalles</button>
        </div>
      </div>`;
    container.appendChild(card);
   }

   // Agrega el modal al DOM si aún no existe
   if (!document.getElementById('materiaModal')) {
    const modalContent = `
      <div class="modal fade" id="materiaModal" tabindex="-1" aria-labelledby="materiaModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="materiaModalLabel">Detalles de la Materia</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <p><strong>Nombre:</strong> <span id="modalNombre"></span></p>
              <p><strong>Descripción:</strong> <span id="modalDescripcion"></span></p>
              <p><strong>Profesor:</strong> <span id="modalProfesor"></span></p>
              <p><strong>Correo:</strong> <span id="modalCorreoProfesor"></span></p>
              <p><strong>Última Calificación:</strong> <span id="modalCalificacion"></span></p>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalContent);
   }

  } catch (err) {
   console.error('Error al cargar calificaciones:', err);
   const container = document.getElementById('calificacionesContainer');
   container.innerHTML = '<div>Error al cargar las calificaciones. Inténtalo nuevamente.</div>';
  }
 }

 // Ahora la función mostrarDetallesMateria acepta un segundo argumento: la calificación
 async function mostrarDetallesMateria(subjectId, grade) {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
   // Realiza la petición para obtener los detalles de la materia
   const response = await fetch(`${apiBaseUrl}/api/subjects/${subjectId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
   });
   const data = await response.json();

   const materia = data.data;
   // Rellena los campos del modal con la información de la materia
   document.getElementById('modalNombre').textContent = materia.name || 'No disponible';
   document.getElementById('modalDescripcion').textContent = materia.description || 'Sin descripción';
   document.getElementById('modalProfesor').textContent = materia.teacher?.name || 'No asignado';
   document.getElementById('modalCorreoProfesor').textContent = materia.teacher?.email || 'No disponible';
   // Rellena el nuevo campo con la calificación pasada como argumento
   document.getElementById('modalCalificacion').textContent = grade || 'N/A';


   // Muestra el modal
   const modal = new bootstrap.Modal(document.getElementById('materiaModal'));
   modal.show();
  } catch (err) {
   console.error('Error al cargar detalles de la materia:', err);
  }
 }

function editarPerfil() {
  alert('Función no implementada aún');
}

// Inicializar
window.onload = async () => {
  await cargarConfiguracion();
  cargarPerfil();
  cargarMaterias();
  setInterval(cargarMaterias, 30000);
};
