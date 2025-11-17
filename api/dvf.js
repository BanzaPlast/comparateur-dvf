const https = require('https');
const http = require('http');

function fetchData(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
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
        const { citycode, postcode, street, housenumber, typeLocal, surface } = req.body;

        if (!postcode && !citycode) {
            return res.status(400).json({ error: 'postcode ou citycode requis' });
        }

        // Construction de la requête pour l'API Etalab
        let query = '';
        
        // Construire l'adresse complète si possible
        if (housenumber && street && postcode) {
            query = `${housenumber} ${street} ${postcode}`;
        } else if (street && postcode) {
            query = `${street} ${postcode}`;
        } else if (postcode) {
            query = postcode;
        }

        console.log('Requête Etalab:', query);

        const url = `https://app.dvf.etalab.gouv.fr/api/transactions?q=${encodeURIComponent(query)}`;
        console.log('URL complète:', url);

        const data = await fetchData(url);
        
        console.log('Réponse reçue:', data ? 'oui' : 'non');

        if (!data || !data.results || !Array.isArray(data.results)) {
            return res.status(200).json({ 
                error: 'Aucune transaction trouvée',
                transactions: []
            });
        }

        let allTransactions = data.results;
        console.log('Transactions totales:', allTransactions.length);

        // Filtrer par type de local
        if (typeLocal) {
            allTransactions = allTransactions.filter(t => {
                const type = t.type_local || '';
                return type.toLowerCase() === typeLocal.toLowerCase();
            });
            console.log('Après filtrage type:', allTransactions.length);
        }

        // Filtrer uniquement les ventes avec surface et valeur valides
        allTransactions = allTransactions.filter(t => {
            const surfaceTrans = parseFloat(t.surface_reelle_bati || t.surface_terrain || 0);
            const valeur = parseFloat(t.valeur_fonciere || 0);
            return surfaceTrans > 0 && valeur > 0;
        });
        
        console.log('Après filtrage validité:', allTransactions.length);

        // Identifier si on a des transactions de la même rue
        let transactionsMemeRue = [];
        if (street) {
            transactionsMemeRue = allTransactions.filter(t => {
                const adresseVoie = (t.adresse_nom_voie || '').toLowerCase();
                const rueRecherchee = street.toLowerCase();
                return adresseVoie.includes(rueRecherchee) || rueRecherchee.includes(adresseVoie);
            });
            console.log('Même rue:', transactionsMemeRue.length);
        }

        const transactionsARetourner = transactionsMemeRue.length > 0 ? transactionsMemeRue : allTransactions;

        return res.status(200).json({
            transactions: transactionsARetourner,
            memeRue: transactionsMemeRue.length > 0,
            total: transactionsARetourner.length
        });

    } catch (error) {
        console.error('Erreur serveur:', error);
        return res.status(500).json({ 
            error: 'Erreur interne',
            message: error.message
        });
    }
};
