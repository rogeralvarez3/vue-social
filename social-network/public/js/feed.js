const me = Auth.getUser();
if (!me) window.location.href = '/index.html';

document.getElementById('me-name').textContent = me?.fullName || me?.username || '';

document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await Api.logout(); } catch {}
  Auth.logoutLocal();
  window.location.href = '/index.html';
});

const postsList = document.getElementById('posts-list');

function fechaLegible(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function iniciales(nombre) {
  return (nombre || '?').trim().charAt(0).toUpperCase();
}

function renderPost(post) {
  const div = document.createElement('div');
  div.className = 'post-card';
  div.dataset.postId = post.id;

  const nombreAutor = post.author?.fullName || post.author?.username || 'Usuario';

  div.innerHTML = `
    <div class="post-header">
      <div class="avatar">${iniciales(nombreAutor)}</div>
      <div>
        <div class="author">${nombreAutor}</div>
        <div class="date">${fechaLegible(post.createdAt)}</div>
      </div>
    </div>
    <div class="content">${escapeHtml(post.content || '')}</div>
    ${post.imageUrl ? `<img class="post-image" src="${post.imageUrl}" alt="Imagen de la publicacion">` : ''}
    <div class="post-actions">
      <button class="btn-like ${post.likedByMe ? 'liked' : ''}">👍 Me gusta (<span class="like-count">${post.likesCount || 0}</span>)</button>
      <button class="btn-comment">💬 Comentar (<span class="comment-count">${post.commentsCount || 0}</span>)</button>
    </div>
  `;

  div.querySelector('.btn-like').addEventListener('click', () => toggleLike(post.id, div));
  div.querySelector('.btn-comment').addEventListener('click', () => {
    const texto = prompt('Escribe tu comentario:');
    if (texto && texto.trim()) enviarComentario(post.id, texto.trim());
  });

  return div;
}

function escapeHtml(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

async function toggleLike(postId, cardEl) {
  const btn = cardEl.querySelector('.btn-like');
  const countEl = cardEl.querySelector('.like-count');
  const yaLeGusta = btn.classList.contains('liked');
  try {
    if (yaLeGusta) {
      await Api.likes({ action: 'borrar', postId });
      btn.classList.remove('liked');
      countEl.textContent = Math.max(0, Number(countEl.textContent) - 1);
    } else {
      await Api.likes({ action: 'crear', postId });
      btn.classList.add('liked');
      countEl.textContent = Number(countEl.textContent) + 1;
    }
  } catch (err) {
    alert(err.message);
  }
}

async function enviarComentario(postId, content) {
  try {
    await Api.comments({ action: 'crear', postId, content });
    const cardEl = postsList.querySelector(`[data-post-id="${postId}"]`);
    const countEl = cardEl?.querySelector('.comment-count');
    if (countEl) countEl.textContent = Number(countEl.textContent) + 1;
  } catch (err) {
    alert(err.message);
  }
}

async function cargarFeed() {
  try {
    const data = await Api.posts({ action: 'listar', page: 1, limit: 20 });
    document.getElementById('loading-msg')?.remove();
    postsList.innerHTML = '';
    data.posts.forEach(post => postsList.appendChild(renderPost(post)));
  } catch (err) {
    postsList.innerHTML = `<p class="error">Error al cargar el feed: ${err.message}</p>`;
  }
}

document.getElementById('form-post').addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = document.getElementById('post-content').value.trim();
  const fileInput = document.getElementById('post-image');

  try {
    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('action', 'crear');
      formData.append('content', content);
      formData.append('image', fileInput.files[0]);
      await Api.postsForm(formData);
    } else {
      await Api.posts({ action: 'crear', content });
    }
    document.getElementById('post-content').value = '';
    fileInput.value = '';
    cargarFeed();
  } catch (err) {
    alert(err.message);
  }
});

// ---------------------------------------------------------
// TIEMPO REAL
// ---------------------------------------------------------
socket.on('post:nuevo', (post) => {
  postsList.prepend(renderPost(post));
});

socket.on('comentario:nuevo', ({ postId }) => {
  const cardEl = postsList.querySelector(`[data-post-id="${postId}"]`);
  const countEl = cardEl?.querySelector('.comment-count');
  if (countEl) countEl.textContent = Number(countEl.textContent) + 1;
});

socket.on('like:nuevo', ({ postId }) => {
  const cardEl = postsList.querySelector(`[data-post-id="${postId}"]`);
  const countEl = cardEl?.querySelector('.like-count');
  if (countEl) countEl.textContent = Number(countEl.textContent) + 1;
});

const notifCountEl = document.getElementById('notif-count');
const notifPanel = document.getElementById('notif-panel');
let notifCount = 0;

document.getElementById('btn-notifs').addEventListener('click', () => {
  notifPanel.classList.toggle('hidden');
});

socket.on('notificacion:nueva', (notif) => {
  notifCount++;
  notifCountEl.textContent = notifCount;
  notifCountEl.classList.remove('hidden');

  const item = document.createElement('div');
  item.className = 'notif-item';
  const textos = { like: 'le dio like a tu publicacion', comment: 'comento tu publicacion' };
  item.textContent = `Alguien ${textos[notif.type] || 'interactuo contigo'}`;
  notifPanel.prepend(item);
});

cargarFeed();
