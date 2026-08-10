let dbPromise = null;

function openDatabase() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(
            'gsLeadsLocalDB',
            1
        );

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains('devices')) {
                db.createObjectStore('devices', {
                    keyPath: 'deviceId'
                });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            dbPromise = null;
            reject(request.error);
        };
    });

    return dbPromise;
}


// =========================================================
// GET STATUS
// =========================================================

async function getStatus(deviceId) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            'devices',
            'readonly'
        );

        const store = transaction.objectStore(
            'devices'
        );

        const request = store.get(deviceId);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}


// =========================================================
// SET STATUS
// =========================================================

async function setStatus(deviceId, status) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            'devices',
            'readwrite'
        );

        const store = transaction.objectStore(
            'devices'
        );

        const request = store.put({
            deviceId,
            status
        });

        request.onsuccess = () => {
            resolve(true);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}


// =========================================================
// MESSAGE HANDLER
// =========================================================

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (!message || !message.action) {
            return;
        }


        // -------------------------
        // GET STATUS
        // -------------------------

        if (message.action === 'getStatus') {

            getStatus(message.deviceId)
                .then(data => {

                    sendResponse({
                        success: true,
                        data
                    });

                })
                .catch(error => {

                    console.error(
                        'GS-Leads getStatus error:',
                        error
                    );

                    sendResponse({
                        success: false,
                        error: error.message
                    });

                });

            return true;
        }


        // -------------------------
        // SET STATUS
        // -------------------------

        if (message.action === 'setStatus') {

            setStatus(
                message.deviceId,
                message.status
            )
                .then(() => {

                    sendResponse({
                        success: true
                    });

                })
                .catch(error => {

                    console.error(
                        'GS-Leads setStatus error:',
                        error
                    );

                    sendResponse({
                        success: false,
                        error: error.message
                    });

                });

            return true;
        }
    }
);