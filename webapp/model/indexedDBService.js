sap.ui.define([], function () {
    "use strict";

    var DB_NAME = "XcaretRecepArtDB";
    var DB_VERSION = 1;

    var STORE_NAMES = {
        scheduleLine: "ScheduleLine",
        scheduleLineDetail: "ScheduleLineDetail",
        contract: "Contract",
        user: "User",
        projects: "Projects",
        images: "Images",
        signatures: "Signatures",
        pendingOps: "PendingOps"
    };

    var dbInstance = null;

    function openDB() {
        return new Promise(function (resolve, reject) {
            if (dbInstance) return resolve(dbInstance);
            var request = window.indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function (event) {
                var db = event.target.result;
                Object.keys(STORE_NAMES).forEach(function (key) {
                    var store = STORE_NAMES[key];
                    if (!db.objectStoreNames.contains(store)) {
                        db.createObjectStore(store, { keyPath: "id", autoIncrement: false });
                    }
                });
            };
            request.onsuccess = function (event) {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };
            request.onerror = function (event) {
                reject(event.target.error);
            };
        });
    }

    function saveData(store, data) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(store, "readwrite");
                var objStore = tx.objectStore(store);
                objStore.put(data);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function (e) { reject(e.target.error); };
            });
        });
    }

    function saveBulk(store, dataArr) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(store, "readwrite");
                var objStore = tx.objectStore(store);
                dataArr.forEach(function (data) {
                    objStore.put(data);
                });
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function (e) { reject(e.target.error); };
            });
        });
    }

    function getAll(store) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(store, "readonly");
                var objStore = tx.objectStore(store);
                var req = objStore.getAll();
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function (e) { reject(e.target.error); };
            });
        });
    }

    function getById(store, id) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(store, "readonly");
                var objStore = tx.objectStore(store);
                var req = objStore.get(id);
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function (e) { reject(e.target.error); };
            });
        });
    }

    function deleteById(store, id) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(store, "readwrite");
                var objStore = tx.objectStore(store);
                var req = objStore.delete(id);
                req.onsuccess = function () { resolve(); };
                req.onerror = function (e) { reject(e.target.error); };
            });
        });
    }

    function clearStore(store) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(store, "readwrite");
                var objStore = tx.objectStore(store);
                var req = objStore.clear();
                req.onsuccess = function () { resolve(); };
                req.onerror = function (e) { reject(e.target.error); };
            });
        });
    }

    function isOnline() {
        return window.navigator.onLine;
    }

    function addPendingOp(op) {
        return saveData(STORE_NAMES.pendingOps, op);
    }

    function getPendingOps() {
        return getAll(STORE_NAMES.pendingOps);
    }

    function deletePendingOp(id) {
        return deleteById(STORE_NAMES.pendingOps, id);
    }

    function syncPendingOps(processFn) {
        window.addEventListener("online", async function () {
            var ops = await getPendingOps();
            for (var i = 0; i < ops.length; i++) {
                await processFn(ops[i]);
                await deletePendingOp(ops[i].id);
            }
        });
    }

    function saveDetailDoc(EBELN, data) {
        return saveData(STORE_NAMES.scheduleLineDetail, {
            id: EBELN,
            ...data
        });
    }

    function getDetailDoc(EBELN) {
        return getById(STORE_NAMES.scheduleLineDetail, EBELN);
    }

    // --- NUEVO: Funciones para soporte de imágenes offline ---
    // Guarda una imagen en el store Images. Si no se pasa un "id", lo genera a partir de MBLRN + LINE_ID + IMAGE_NAME
    function saveImage(img) {
        const id = img.id || (img.MBLRN + "_" + img.LINE_ID + "_" + img.IMAGE_NAME);
        // El campo de índice puede venir como index o INDEX, asegúrate de que ambos existan y sean el mismo valor
        const indexValue = (typeof img.index !== "undefined") ? img.index : img.INDEX;
        return saveData(STORE_NAMES.images, {
            ...img,
            id,
            index: indexValue,
            INDEX: indexValue
        });
    }

    // Devuelve todas las imágenes en el store Images
    function getAllImages() {
        return getAll(STORE_NAMES.images);
    }

    // Devuelve solo las imágenes pendientes de sincronizar (pending: true)
    function getPendingImages() {
        return getAllImages().then(imgs => imgs.filter(img => img.pending));
    }

    // Marca la imagen como sincronizada (pending: false)
    function markImageAsSynced(id) {
        return getById(STORE_NAMES.images, id).then(function (img) {
            if (!img) return;
            img.pending = false;
            return saveData(STORE_NAMES.images, img);
        });
    }

    // Elimina una imagen por ID (opcional, útil si quieres eliminar tras sincronizar)
    function deleteImage(id) {
        return deleteById(STORE_NAMES.images, id);
    }

    // --- NUEVO: Funciones para soporte de firmas offline ---
    // Guarda una firma en el store Signatures. Si no se pasa un "id", lo genera a partir de DOCID + ID + EMAIL
    function saveSignature(signature) {
        const id = signature.id || (signature.DOCID + "_" + signature.ID + "_" + signature.EMAIL);
        return saveData(STORE_NAMES.signatures, { ...signature, id });
    }

    // Devuelve todas las firmas en el store Signatures
    function getAllSignatures() {
        return getAll(STORE_NAMES.signatures);
    }

    // Devuelve solo las firmas pendientes de sincronizar (pending: true)
    function getPendingSignatures() {
        return getAllSignatures().then(signs => signs.filter(sign => sign.pending));
    }

    // Marca la firma como sincronizada (pending: false)
    /*
    function markSignatureAsSynced(id) {
        return getById(STORE_NAMES.signatures, id).then(function (sign) {
            if (!sign) return;
            sign.pending = false;
            return saveData(STORE_NAMES.signatures, sign);
        });
    }
    */

    function markSignatureAsSynced(id) {
        return getById(STORE_NAMES.signatures, id).then(function (sign) {
            if (!sign) return;
            sign.pending = false;
            sign.synced = true;
            return saveData(STORE_NAMES.signatures, sign);
        });
    }

    // Elimina una firma por ID
    function deleteSignature(id) {
        return deleteById(STORE_NAMES.signatures, id);
    }

    return {
        DB_NAME: DB_NAME,
        DB_VERSION: DB_VERSION,
        STORE_NAMES: STORE_NAMES,
        openDB: openDB,
        saveData: saveData,
        saveBulk: saveBulk,
        getAll: getAll,
        getById: getById,
        deleteById: deleteById,
        clearStore: clearStore,
        isOnline: isOnline,
        addPendingOp: addPendingOp,
        getPendingOps: getPendingOps,
        deletePendingOp: deletePendingOp,
        syncPendingOps: syncPendingOps,
        saveDetailDoc: saveDetailDoc,
        getDetailDoc: getDetailDoc,
        // NUEVAS funciones para imágenes offline:
        saveImage: saveImage,
        getAllImages: getAllImages,
        getPendingImages: getPendingImages,
        markImageAsSynced: markImageAsSynced,
        deleteImage: deleteImage,
        // NUEVAS funciones para firmas offline:
        saveSignature: saveSignature,
        getAllSignatures: getAllSignatures,
        getPendingSignatures: getPendingSignatures,
        markSignatureAsSynced: markSignatureAsSynced,
        deleteSignature: deleteSignature
    };
});