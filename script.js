// ==========================================
// IMPORTACIÓN DE FIREBASE (Versión Modular)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE
// ==========================================
// REEMPLAZA ESTO CON LA CONFIGURACIÓN DE TU PROYECTO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDB-gS7vN9njSXqRMtPC19hMDU6qWEPwzQ",
  authDomain: "gacha-86072.firebaseapp.com",
  projectId: "gacha-86072",
  storageBucket: "gacha-86072.firebasestorage.app",
  messagingSenderId: "1090847745401",
  appId: "1:1090847745401:web:66cfb777a058966a8fbba8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables Globales
let currentUser = null;
let userData = null;
let cratesData = [];
let selectedCrate = null;

// ==========================================
// 2. REFERENCIAS DEL DOM
// ==========================================
const screens = {
    auth: document.getElementById('auth-screen'),
    main: document.getElementById('main-screen')
};
const ui = {
    nick: document.getElementById('user-nick'),
    tokens: document.getElementById('user-tokens'),
    pity: document.getElementById('pity-counter'),
    btnAdmin: document.getElementById('btn-admin-panel'),
    cratesList: document.getElementById('crates-list'),
    crateName: document.getElementById('selected-crate-name'),
    crateDesc: document.getElementById('selected-crate-desc'),
    cratePreview: document.getElementById('crate-preview'),
    gachaActions: document.getElementById('gacha-actions'),
    inventoryList: document.getElementById('inventory-list'),
    historyList: document.getElementById('history-list')
};

// ==========================================
// 3. SISTEMA DE AUTENTICACIÓN (Actualizado para Nick)
// ==========================================

// Iniciar sesión
document.getElementById('btn-login').addEventListener('click', async (e) => {
    e.preventDefault();
    const nick = document.getElementById('nick').value.trim();
    const pass = document.getElementById('password').value;
    
    // Engañamos a Firebase creando un correo falso con el nick
    const fakeEmail = nick.toLowerCase() + "@gacha.local";

    try {
        await signInWithEmailAndPassword(auth, fakeEmail, pass);
    } catch (error) {
        document.getElementById('auth-error').innerText = "Credenciales incorrectas o usuario no existe.";
    }
});

// Registrarse
document.getElementById('btn-register').addEventListener('click', async (e) => {
    e.preventDefault();
    const nick = document.getElementById('nick').value.trim();
    const pass = document.getElementById('password').value;
    
    if(!nick || pass.length < 6) {
        document.getElementById('auth-error').innerText = "Ingresa tu Nick y una contraseña (mínimo 6 caracteres).";
        return;
    }

    const fakeEmail = nick.toLowerCase() + "@gacha.local";

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
        const user = userCredential.user;
        
        // AQUÍ DEFINIMOS QUIÉN ES EL ADMIN AUTOMÁTICAMENTE
        // Cambia "ElAdminSupremo" por el Nick exacto que usará el administrador
        const userRole = (nick === "ElAdminSupremo") ? "admin" : "player";

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            nick: nick,
            tokens: 0,
            inventory: {},
            pityCounter: 0,
            role: userRole,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        document.getElementById('auth-error').innerText = "Error: El usuario ya existe o la contraseña es muy débil.";
    }
});

// Cerrar sesión
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// Observador de estado de sesión
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        screens.auth.classList.remove('active');
        screens.main.classList.add('active');
        loadUserData();
        loadCrates();
        loadGlobalHistory();
    } else {
        currentUser = null;
        userData = null;
        screens.auth.classList.add('active');
        screens.main.classList.remove('active');
    }
});

// ==========================================
// 4. CARGA DE DATOS (Tiempo Real)
// ==========================================
function loadUserData() {
    const userRef = doc(db, "users", currentUser.uid);
    // onSnapshot permite que los tokens e inventario se actualicen en tiempo real
    onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            ui.nick.innerText = userData.nick;
            ui.tokens.innerText = userData.tokens;
            ui.pity.innerText = userData.pityCounter || 0;
            
            if (userData.role === "admin") {
                ui.btnAdmin.classList.remove('hidden');
                loadAdminUsersList();
            }

            renderInventory(userData.inventory);
        }
    });
}

async function loadCrates() {
    const cratesSnapshot = await getDocs(collection(db, "crates"));
    cratesData = [];
    ui.cratesList.innerHTML = '';
    
    cratesSnapshot.forEach((doc) => {
        const crate = { id: doc.id, ...doc.data() };
        cratesData.push(crate);
        
        const div = document.createElement('div');
        div.className = 'crate-card';
        div.innerHTML = `<h3>${crate.name}</h3>`;
        div.onclick = () => selectCrate(crate, div);
        ui.cratesList.appendChild(div);
    });
}

function loadGlobalHistory() {
    const historyQuery = query(collection(db, "history"), orderBy("timestamp", "desc"), limit(20));
    onSnapshot(historyQuery, (snapshot) => {
        ui.historyList.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 'Reciente';
            ui.historyList.innerHTML += `
                <div class="history-entry">
                    <strong>${data.nick}</strong> obtuvo <span class="rarity-${data.rarity}">${data.item}</span> 
                    (Caja: ${data.crateName})
                    <span class="date">${date}</span>
                </div>
            `;
        });
    });
}

// ==========================================
// 5. LÓGICA DE INTERFAZ
// ==========================================
function selectCrate(crate, element) {
    document.querySelectorAll('.crate-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    
    selectedCrate = crate;
    ui.crateName.innerText = crate.name;
    ui.crateDesc.innerText = crate.description || "Tira para obtener recompensas increíbles.";
    ui.gachaActions.classList.remove('hidden');
    
    ui.cratePreview.innerHTML = crate.items.map(item => `
        <div class="preview-item rarity-${item.rarity}">
            ${item.name} (${item.chance}%)
        </div>
    `).join('');
}

// Pestañas
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// ==========================================
// 6. SISTEMA GACHA Y PROBABILIDADES
// ==========================================
document.getElementById('btn-pull-1').addEventListener('click', () => pullGacha(1));
document.getElementById('btn-pull-10').addEventListener('click', () => pullGacha(10));

async function pullGacha(amount) {
    if (!selectedCrate) return alert("Selecciona una caja primero");
    if (userData.tokens < amount) return alert("No tienes suficientes tokens");

    const cost = amount;
    let currentPity = userData.pityCounter || 0;
    const results = [];
    let historyBatch = [];
    const newInventory = { ...userData.inventory };

    // Calcular tiradas
    for (let i = 0; i < amount; i++) {
        currentPity++;
        let forceHighRarity = false;
        
        // PITY SYSTEM: A la tirada 10 sin épico/legendario, forzamos uno
        if (currentPity >= 10) {
            forceHighRarity = true;
        }

        const pulledItem = rollItem(selectedCrate.items, forceHighRarity);
        
        // Si sale épico o legendario, reseteamos pity
        if (pulledItem.rarity === "Epic" || pulledItem.rarity === "Legendary") {
            currentPity = 0;
        }

        results.push(pulledItem);

        // Sumar al inventario localmente
        if (newInventory[pulledItem.name]) {
            newInventory[pulledItem.name].amount += 1;
        } else {
            newInventory[pulledItem.name] = { rarity: pulledItem.rarity, amount: 1 };
        }

        // Preparar historial
        historyBatch.push({
            uid: currentUser.uid,
            nick: userData.nick,
            item: pulledItem.name,
            rarity: pulledItem.rarity,
            crateName: selectedCrate.name,
            timestamp: serverTimestamp()
        });
    }

    // Actualizar Firebase
    const userRef = doc(db, "users", currentUser.uid);
    try {
        await updateDoc(userRef, {
            tokens: increment(-cost),
            pityCounter: currentPity,
            inventory: newInventory
        });

        // Guardar historiales
        for (const record of historyBatch) {
            await addDoc(collection(db, "history"), record);
        }

        showResultsModal(results);
    } catch (error) {
        alert("Hubo un error al procesar la tirada.");
        console.error(error);
    }
}

function rollItem(items, forceHighRarity) {
    let pool = items;
    
    if (forceHighRarity) {
        pool = items.filter(i => i.rarity === "Epic" || i.rarity === "Legendary");
        // Si la caja no tiene épicos/legendarios (raro, pero posible), usar todo el pool
        if (pool.length === 0) pool = items; 
    }

    const totalWeight = pool.reduce((acc, item) => acc + item.chance, 0);
    let random = Math.random() * totalWeight;

    for (const item of pool) {
        random -= item.chance;
        if (random <= 0) {
            return item;
        }
    }
    return pool[pool.length - 1]; // Fallback
}

function renderInventory(inventory) {
    ui.inventoryList.innerHTML = '';
    for (const [itemName, data] of Object.entries(inventory)) {
        ui.inventoryList.innerHTML += `
            <div class="inv-item rarity-${data.rarity}">
                <strong>${itemName}</strong><br>
                x${data.amount}
            </div>
        `;
    }
}

// Animación de Resultados
function showResultsModal(results) {
    const modal = document.getElementById('result-modal');
    const title = document.getElementById('result-title');
    const itemsContainer = document.getElementById('result-items');
    const btnClose = document.getElementById('btn-close-result');
    
    modal.classList.remove('hidden');
    title.innerText = "¡Abriendo...";
    itemsContainer.innerHTML = '';
    btnClose.classList.add('hidden');

    // Simular tiempo de apertura
    setTimeout(() => {
        title.innerText = "¡Recompensas Obtenidas!";
        itemsContainer.innerHTML = results.map(item => `
            <div class="result-item rarity-${item.rarity}">
                <div style="font-weight:bold; font-size:1.2em">${item.name}</div>
                <div style="font-size:0.8em; margin-top:5px">${item.rarity}</div>
            </div>
        `).join('');
        btnClose.classList.remove('hidden');
    }, 1500);
}

document.getElementById('btn-close-result').addEventListener('click', () => {
    document.getElementById('result-modal').classList.add('hidden');
});


// ==========================================
// 7. PANEL DE ADMINISTRADOR
// ==========================================
document.getElementById('btn-admin-panel').addEventListener('click', () => {
    document.getElementById('admin-modal').classList.remove('hidden');
});

document.getElementById('close-admin').addEventListener('click', () => {
    document.getElementById('admin-modal').classList.add('hidden');
    document.getElementById('admin-msg').innerText = '';
});

async function loadAdminUsersList() {
    const select = document.getElementById('admin-user-select');
    select.innerHTML = '<option value="">Selecciona un jugador...</option>';
    const snapshot = await getDocs(collection(db, "users"));
    
    snapshot.forEach(doc => {
        const data = doc.data();
        select.innerHTML += `<option value="${doc.id}">${data.nick} (${data.tokens} tokens)</option>`;
    });
}

document.getElementById('btn-add-tokens').addEventListener('click', async () => {
    const uid = document.getElementById('admin-user-select').value;
    const amount = parseInt(document.getElementById('admin-tokens-amount').value);
    
    if (!uid || isNaN(amount)) return alert("Selecciona usuario y cantidad válida.");
    
    try {
        await updateDoc(doc(db, "users", uid), {
            tokens: increment(amount)
        });
        document.getElementById('admin-msg').innerText = `Se añadieron ${amount} tokens exitosamente.`;
        loadAdminUsersList(); // Actualizar lista
    } catch (e) {
        document.getElementById('admin-msg').innerText = "Error: " + e.message;
    }
});

// Cajas por defecto (Instalador rápido para el admin)
document.getElementById('btn-init-crates').addEventListener('click', async () => {
    if(!confirm("Esto creará las 4 cajas iniciales en la base de datos. ¿Continuar?")) return;
    
    const defaultCrates = [
        {
            name: "Caja de Armas Cuerpo a Cuerpo",
            description: "Armas ideales para el combate cercano contra zombies.",
            items: [
                { name: "Knife", rarity: "Common", chance: 40 },
                { name: "Axe", rarity: "Uncommon", chance: 30 },
                { name: "Machete", rarity: "Rare", chance: 20 },
                { name: "Katana", rarity: "Epic", chance: 8 },
                { name: "Chainsaw", rarity: "Legendary", chance: 2 }
            ]
        },
        {
            name: "Caja de Armas Normales",
            description: "Fuego estándar para mantener la distancia.",
            items: [
                { name: "Pistol", rarity: "Common", chance: 40 },
                { name: "Shotgun", rarity: "Uncommon", chance: 30 },
                { name: "SMG", rarity: "Rare", chance: 20 },
                { name: "Assault Rifle", rarity: "Epic", chance: 10 }
            ]
        },
        {
            name: "Caja Militar",
            description: "Armamento pesado y táctico de alto calibre.",
            items: [
                { name: "Tactical Pistol", rarity: "Uncommon", chance: 40 },
                { name: "Military Rifle", rarity: "Rare", chance: 35 },
                { name: "Sniper", rarity: "Epic", chance: 20 },
                { name: "Heavy Minigun", rarity: "Legendary", chance: 5 }
            ]
        },
        {
            name: "Caja de Mascotas",
            description: "Compañeros leales para el apocalipsis.",
            items: [
                { name: "Stray Dog", rarity: "Rare", chance: 60 },
                { name: "Wolf", rarity: "Epic", chance: 35 },
                { name: "Mutated Bear", rarity: "Legendary", chance: 5 }
            ]
        }
    ];

    try {
        for (const crate of defaultCrates) {
            await addDoc(collection(db, "crates"), crate);
        }
        alert("Cajas inicializadas correctamente. Recarga la página.");
        loadCrates();
    } catch (error) {
        alert("Error al crear cajas: " + error.message);
    }
});
