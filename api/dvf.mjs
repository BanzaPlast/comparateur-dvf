// api/dvf.js - Serverless Function pour Vercel

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
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
        
        // Tentative 1: Recherche par code commune
        if (citycode) {
            try {
                const url = `https://api.cquest.org/dvf?code_commune=${citycode}&type_local=${typeLocal}&nature_mutation=Vente`;
                console.log('DVF URL commune:', url);
                
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.resultats) {
                        allTransactions = data.resultats;
                    } else if (Array.isArray(data)) {
                        allTransactions = data;
                    }
                }
            } catch (error) {
                console.error('Erreur API commune:', error);
            }
        }

        // Tentative 2: Recherche par code postal si pas assez de résultats
        if (allTransactions.length < 10 && postcode) {
            try {
                const url = `https://api.cquest.org/dvf?code_postal=${postcode}&type_local=${typeLocal}&nature_mutation=Vente`;
                console.log('DVF URL postal:', url);
                
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.resultats) {
                        allTransactions = [...allTransactions, ...data.resultats];
                    } else if (Array.isArray(data)) {
                        allTransactions = [...allTransactions, ...data];
                    }
                }
            } catch (error) {
                console.error('Erreur API postal:', error);
            }
        }

        console.log(`Transactions totales trouvées: ${allTransactions.length}`);

        if (allTransactions.length === 0) {
            return res.status(404).json({ 
                error: 'Aucune transaction trouvée',
                transactions: []
            });
        }

        // Filtrer par rue si disponible
        let transactionsMemeRue = [];
        if (street) {
            transactionsMemeRue = allTransactions.filter(t => {
                const adresseVoie = (t.adresse_nom_voie || '').toLowerCase();
                const rueRecherchee = street.toLowerCase();
                return adresseVoie.includes(rueRecherchee) || rueRecherchee.includes(adresseVoie);
            });
        }

        const transactionsAUtiliser = transactionsMemeRue.length > 5 
            ? transactionsMemeRue 
            : allTransactions;

        // Filtrer par surface (±10m²)
        const surfaceMin = surface - 10;
        const surfaceMax = surface + 10;

        let transactionsFiltrees = transactionsAUtiliser.filter(t => {
            const surfaceTrans = parseFloat(t.surface_reelle_bati || t.surface_terrain || 0);
            const valeur = parseFloat(t.valeur_fonciere || 0);
            return surfaceTrans >= surfaceMin && 
                   surfaceTrans <= surfaceMax &&
                   valeur > 0;
        });

        // Si pas assez de résultats, élargir à ±20m²
        if (transactionsFiltrees.length < 3) {
            const surfaceMin2 = surface - 20;
            const surfaceMax2 = surface + 20;

            transactionsFiltrees = transactionsAUtiliser.filter(t => {
                const surfaceTrans = parseFloat(t.surface_reelle_bati || t.surface_terrain || 0);
                const valeur = parseFloat(t.valeur_fonciere || 0);
                return surfaceTrans >= surfaceMin2 && 
                       surfaceTrans <= surfaceMax2 &&
                       valeur > 0;
            });
        }

        console.log(`Transactions filtrées: ${transactionsFiltrees.length}`);

        return res.status(200).json({
            transactions: transactionsFiltrees,
            memeRue: transactionsMemeRue.length > 0,
            total: allTransactions.length
        });

    } catch (error) {
        console.error('Erreur serveur:', error);
        return res.status(500).json({ 
            error: 'Erreur interne du serveur',
            message: error.message 
        });
    }
