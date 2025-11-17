const https = require('https');

function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { citycode, postcode, street, typeLocal, surface } = req.body;

        console.log('Requête reçue:', { citycode, postcode, street, typeLocal, surface });

        if (!citycode && !postcode) {
            return res.status(400).json({ error: 'citycode ou postcode requis' });
        }

        let allTransactions = [];
        
        // Essayer avec code postal d'abord (plus fiable)
        if (postcode) {
            try {
                const url = `https://api.cquest.org/dvf?code_postal=${postcode}&type_local=${encodeURIComponent(typeLocal)}`;
                console.log('Appel API:', url);
                const data = await fetchData(url);
                
                console.log('Données reçues:', data ? 'oui' : 'non');
                
                if (data && data.resultats && Array.isArray(data.resultats)) {
                    allTransactions = data.resultats;
                } else if (Array.isArray(data)) {
                    allTransactions = data;
                }
                
                console.log('Transactions trouvées:', allTransactions.length);
            } catch (error) {
                console.error('Erreur API postal:', error);
            }
        }

        // Si pas assez de résultats, essayer avec citycode
        if (allTransactions.length < 10 && citycode) {
            try {
                const url = `https://api.cquest.org/dvf?code_commune=${citycode}&type_local=${encodeURIComponent(typeLocal)}`;
                console.log('Appel API commune:', url);
                const data = await fetchData(url);
                
                if (data && data.resultats && Array.isArray(data.resultats)) {
                    allTransactions = [...allTransactions, ...data.resultats];
                } else if (Array.isArray(data)) {
                    allTransactions = [...allTransactions, ...data];
                }
                
                console.log('Transactions totales:', allTransactions.length);
            } catch (error) {
                console.error('Erreur API commune:', error);
            }
        }

        if (allTransactions.length === 0) {
            return res.status(200).json({ 
                error: 'Aucune transaction trouvée',
                transactions: [],
                debug: { postcode, citycode, typeLocal }
            });
        }

        // Filtrer uniquement les ventes
        allTransactions = allTransactions.filter(t => {
            const nature = t.nature_mutation || '';
            return nature.toLowerCase().includes('vente');
        });

        console.log('Après filtrage ventes:', allTransactions.length);

        // Filtrer par rue si disponible
        let transactionsMemeRue = [];
        if (street) {
            transactionsMemeRue = allTransactions.filter(t => {
                const adresseVoie = (t.adresse_nom_voie || '').toLowerCase();
                const rueRecherchee = street.toLowerCase();
                return adresseVoie.includes(rueRecherchee) || rueRecherchee.includes(adresseVoie);
            });
            console.log('Transactions même rue:', transactionsMemeRue.length);
        }

        const transactionsAUtiliser = transactionsMemeRue.length > 5 ? transactionsMemeRue : allTransactions;

        // Filtrer par surface (±10m²)
        const surfaceMin = surface - 10;
        const surfaceMax = surface + 10;

        let transactionsFiltrees = transactionsAUtiliser.filter(t => {
            const surfaceTrans = parseFloat(t.surface_reelle_bati || t.surface_terrain || 0);
            const valeur = parseFloat(t.valeur_fonciere || 0);
            return surfaceTrans > 0 && surfaceTrans >= surfaceMin && surfaceTrans <= surfaceMax && valeur > 0;
        });

        console.log('Après filtrage surface ±10m²:', transactionsFiltrees.length);

        // Si pas assez de résultats, élargir à ±20m²
        if (transactionsFiltrees.length < 3) {
            const surfaceMin2 = surface - 20;
            const surfaceMax2 = surface + 20;

            transactionsFiltrees = transactionsAUtiliser.filter(t => {
                const surfaceTrans = parseFloat(t.surface_reelle_bati || t.surface_terrain || 0);
                const valeur = parseFloat(t.valeur_fonciere || 0);
                return surfaceTrans > 0 && surfaceTrans >= surfaceMin2 && surfaceTrans <= surfaceMax2 && valeur > 0;
            });
            
            console.log('Après élargissement ±20m²:', transactionsFiltrees.length);
        }

        return res.status(200).json({
            transactions: transactionsFiltrees,
            memeRue: transactionsMemeRue.length > 0,
            total: allTransactions.length
        });

    } catch (error) {
        console.error('Erreur serveur:', error);
        return res.status(500).json({ 
            error: 'Erreur interne',
            message: error.message
        });
    }
};
