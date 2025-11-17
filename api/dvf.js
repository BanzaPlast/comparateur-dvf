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

        if (!citycode && !postcode) {
            return res.status(400).json({ error: 'citycode ou postcode requis' });
        }

        let allTransactions = [];
        
        // Recherche par code postal
        if (postcode) {
            try {
                const url = `https://api.cquest.org/dvf?code_postal=${postcode}&type_local=${encodeURIComponent(typeLocal)}`;
                const data = await fetchData(url);
                
                if (data && data.resultats && Array.isArray(data.resultats)) {
                    allTransactions = data.resultats;
                } else if (Array.isArray(data)) {
                    allTransactions = data;
                }
            } catch (error) {
                console.error('Erreur API postal:', error);
            }
        }

        // Recherche par citycode si pas assez
        if (allTransactions.length < 10 && citycode) {
            try {
                const url = `https://api.cquest.org/dvf?code_commune=${citycode}&type_local=${encodeURIComponent(typeLocal)}`;
                const data = await fetchData(url);
                
                if (data && data.resultats && Array.isArray(data.resultats)) {
                    allTransactions = [...allTransactions, ...data.resultats];
                } else if (Array.isArray(data)) {
                    allTransactions = [...allTransactions, ...data];
                }
            } catch (error) {
                console.error('Erreur API commune:', error);
            }
        }

        if (allTransactions.length === 0) {
            return res.status(200).json({ 
                error: 'Aucune transaction trouvée',
                transactions: []
            });
        }

        // Filtrer uniquement les ventes avec surface et valeur valides
        allTransactions = allTransactions.filter(t => {
            const nature = t.nature_mutation || '';
            const surfaceTrans = parseFloat(t.surface_reelle_bati || t.surface_terrain || 0);
            const valeur = parseFloat(t.valeur_fonciere || 0);
            return nature.toLowerCase().includes('vente') && surfaceTrans > 0 && valeur > 0;
        });

        // Filtrer par rue si disponible
        let transactionsMemeRue = [];
        if (street) {
            transactionsMemeRue = allTransactions.filter(t => {
                const adresseVoie = (t.adresse_nom_voie || '').toLowerCase();
                const rueRecherchee = street.toLowerCase();
                return adresseVoie.includes(rueRecherchee) || rueRecherchee.includes(adresseVoie);
            });
        }

        // NOUVEAU : Utiliser TOUTES les transactions (pas de filtrage par surface)
        const transactionsAUtiliser = transactionsMemeRue.length > 5 ? transactionsMemeRue : allTransactions;

        // Retourner TOUTES les transactions trouvées
        return res.status(200).json({
            transactions: transactionsAUtiliser,
            memeRue: transactionsMemeRue.length > 0,
            total: transactionsAUtiliser.length
        });

    } catch (error) {
        console.error('Erreur serveur:', error);
        return res.status(500).json({ 
            error: 'Erreur interne',
            message: error.message
        });
    }
};
