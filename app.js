const form = document.getElementById('compareForm');
const loadingCard = document.getElementById('loadingCard');
const resultsCard = document.getElementById('resultsCard');
const resultsContent = document.getElementById('resultsContent');
const formCard = document.getElementById('formCard');
const resetBtn = document.getElementById('resetBtn');
const adresseInput = document.getElementById('adresse');
const autocompleteList = document.getElementById('autocomplete-list');
const dvfFileInput = document.getElementById('dvfFile');
const fileUploadLabel = document.getElementById('fileUploadLabel');
const fileUploadContainer = document.getElementById('fileUploadContainer');

let currentAdresseData = null;
let debounceTimer = null;
let dvfData = null; // Stockage des données DVF locales

// Gestionnaire de chargement de fichier
dvfFileInput.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        dvfData = JSON.parse(text);

        // Vérifier que c'est un tableau
        if (!Array.isArray(dvfData)) {
            throw new Error('Le fichier doit contenir un tableau de transactions');
        }

        fileUploadLabel.textContent = `✅ ${file.name} (${dvfData.length} transactions)`;
        fileUploadContainer.classList.add('has-file');
        console.log(`Fichier DVF chargé: ${dvfData.length} transactions`);
    } catch (error) {
        alert(`Erreur lors du chargement du fichier: ${error.message}`);
        dvfFileInput.value = '';
        fileUploadLabel.textContent = '📂 Sélectionner un fichier DVF (JSON)';
        fileUploadContainer.classList.remove('has-file');
        dvfData = null;
    }
});

// Autocomplétion d'adresse
adresseInput.addEventListener('input', function() {
    const value = this.value.trim();
    
    clearTimeout(debounceTimer);
    autocompleteList.innerHTML = '';
    
    if (value.length < 3) {
        return;
    }
    
    debounceTimer = setTimeout(async () => {
        try {
            const response = await fetch(
                `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(value)}&limit=5`
            );
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
                data.features.forEach(feature => {
                    const div = document.createElement('div');
                    div.className = 'autocomplete-item';
                    
                    const props = feature.properties;
                    const label = props.label;
                    const type = props.type === 'housenumber' ? '🏠' : '📍';
                    
                    div.innerHTML = `${type} <strong>${label}</strong>`;
                    
                    const selectAddress = (e) => {
                        if (e) e.preventDefault();
                        adresseInput.value = label;
                        currentAdresseData = {
                            label: label,
                            coords: feature.geometry.coordinates,
                            postcode: props.postcode,
                            city: props.city,
                            citycode: props.citycode,
                            street: props.street,
                            housenumber: props.housenumber
                        };
                        autocompleteList.innerHTML = '';
                    };
                    
                    div.addEventListener('click', selectAddress);
                    div.addEventListener('touchend', selectAddress);
                    
                    autocompleteList.appendChild(div);
                });
            }
        } catch (error) {
            console.error('Erreur autocomplétion:', error);
        }
    }, 300);
});

// Fermer l'autocomplétion
document.addEventListener('click', function(e) {
    if (e.target !== adresseInput) {
        autocompleteList.innerHTML = '';
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const adresse = adresseInput.value.trim();
    const typeLocal = document.getElementById('typeLocal').value;
    const prix = parseFloat(document.getElementById('prix').value);
    const surface = parseFloat(document.getElementById('surface').value);
    
    formCard.style.display = 'none';
    loadingCard.style.display = 'block';
    resultsCard.classList.remove('show');
    
    try {
        // Vérifier que les données DVF sont chargées
        if (!dvfData || dvfData.length === 0) {
            throw new Error('Veuillez d\'abord charger un fichier DVF');
        }

        // Géocoder si pas déjà fait
        if (!currentAdresseData) {
            const geoResponse = await fetch(
                `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`
            );
            const geoData = await geoResponse.json();

            if (!geoData.features || geoData.features.length === 0) {
                throw new Error('Adresse non trouvée');
            }

            const feature = geoData.features[0];
            const props = feature.properties;

            currentAdresseData = {
                label: props.label,
                coords: feature.geometry.coordinates,
                postcode: props.postcode,
                city: props.city,
                citycode: props.citycode,
                street: props.street,
                housenumber: props.housenumber
            };
        }

        // Filtrer les données localement
        console.log('Filtrage des données pour:', currentAdresseData);

        let allTransactions = [...dvfData];
        console.log('Transactions totales dans le fichier:', allTransactions.length);

        // Filtrer par code postal
        if (currentAdresseData.postcode) {
            allTransactions = allTransactions.filter(t => {
                const codePostal = t.code_postal || '';
                return codePostal === currentAdresseData.postcode;
            });
            console.log('Après filtrage code postal:', allTransactions.length);
        }

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
        if (currentAdresseData.street) {
            transactionsMemeRue = allTransactions.filter(t => {
                const adresseVoie = (t.adresse_nom_voie || '').toLowerCase();
                const rueRecherchee = currentAdresseData.street.toLowerCase();
                return adresseVoie.includes(rueRecherchee) || rueRecherchee.includes(adresseVoie);
            });
            console.log('Même rue:', transactionsMemeRue.length);
        }

        const transactionsARetourner = transactionsMemeRue.length > 0 ? transactionsMemeRue : allTransactions;

        if (transactionsARetourner.length === 0) {
            throw new Error('Aucune transaction trouvée pour cette zone');
        }

        afficherResultats(
            currentAdresseData,
            typeLocal,
            prix,
            surface,
            transactionsARetourner,
            transactionsMemeRue.length > 0
        );
        
    } catch (error) {
        console.error('Erreur:', error);
        resultsContent.innerHTML = `
            <div class="error">
                <strong>❌ Erreur</strong><br>
                ${error.message}
            </div>
            <div class="warning">
                <strong>💡 Conseils:</strong><br>
                • Vérifiez que l'adresse est complète<br>
                • Utilisez l'autocomplétion pour sélectionner une adresse valide<br>
                • Certaines communes ont peu de transactions DVF
            </div>
        `;
        resultsCard.classList.add('show');
    } finally {
        loadingCard.style.display = 'none';
    }
});

function afficherResultats(adresseData, typeLocal, prix, surface, transactions, memeRue) {
    const prixM2List = transactions.map(t => {
        const surfaceTrans = parseFloat(t.surface_reelle_bati || t.surface_terrain);
        return parseFloat(t.valeur_fonciere) / surfaceTrans;
    }).filter(p => p > 0 && isFinite(p));
    
    if (prixM2List.length === 0) {
        throw new Error('Données insuffisantes pour le calcul');
    }
    
    const stats = {
        nombre: prixM2List.length,
        moyen: prixM2List.reduce((a, b) => a + b, 0) / prixM2List.length,
        median: median(prixM2List),
        min: Math.min(...prixM2List),
        max: Math.max(...prixM2List)
    };
    
    const prixM2Propose = prix / surface;
    const diff = prixM2Propose - stats.moyen;
    const diffPct = (diff / stats.moyen) * 100;
    
    let comparisonClass = '';
    let comparisonText = '';
    
    if (diffPct > 20) {
        comparisonClass = 'bad';
        comparisonText = '⚠️ Le prix proposé est SIGNIFICATIVEMENT SUPÉRIEUR à la moyenne';
    } else if (diffPct > 10) {
        comparisonClass = 'bad';
        comparisonText = '⚠️ Le prix proposé est supérieur à la moyenne';
    } else if (diffPct < -20) {
        comparisonClass = 'good';
        comparisonText = '✅ Le prix proposé est TRÈS EN DESSOUS de la moyenne (bonne affaire ?)';
    } else if (diffPct < -10) {
        comparisonClass = 'good';
        comparisonText = '✅ Le prix proposé est en dessous de la moyenne';
    } else {
        comparisonClass = '';
        comparisonText = '✅ Le prix proposé est dans la moyenne du marché';
    }
    
    const prixEstime = stats.moyen * surface;
    
    let html = '';
    
    if (memeRue) {
        html += `
            <div class="info">
                ✅ Données de <strong>${adresseData.street}</strong> prises en compte
            </div>
        `;
    }
    
    html += `
        <div class="info">
            <strong>📍 ${adresseData.label}</strong><br>
            Type: ${typeLocal} | Surface: ${surface} m²<br>
            Prix: ${formatPrice(prix)} (${formatPrice(prixM2Propose)}/m²)
        </div>
        
        <div class="section-title">📊 Statistiques DVF</div>
        
        <div class="stats-grid">
            <div class="stat-box">
                <h3>Prix/m² moyen</h3>
                <div class="value">${formatPrice(stats.moyen)}</div>
            </div>
            <div class="stat-box">
                <h3>Prix/m² médian</h3>
                <div class="value">${formatPrice(stats.median)}</div>
            </div>
            <div class="stat-box">
                <h3>Prix/m² min</h3>
                <div class="value">${formatPrice(stats.min)}</div>
            </div>
            <div class="stat-box">
                <h3>Prix/m² max</h3>
                <div class="value">${formatPrice(stats.max)}</div>
            </div>
        </div>
        
        <div class="stat-box">
            <h3>Nombre de transactions</h3>
            <div class="value">${stats.nombre}</div>
        </div>
        
        <div class="comparison ${comparisonClass}">
            <h3>🎯 Comparaison</h3>
            <div class="diff">${formatDiff(diff)}/m² (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%)</div>
            <p>${comparisonText}</p>
            <hr style="margin: 15px 0; border: none; border-top: 1px solid rgba(0,0,0,0.1);">
            <p><strong>💡 Prix estimé selon moyenne:</strong> ${formatPrice(prixEstime)}</p>
            <p style="margin-top: 5px;">Soit ${formatDiff(prix - prixEstime)} par rapport au prix proposé</p>
        </div>
    `;
    
    // Transactions récentes
    const transactionsSorted = transactions
        .filter(t => t.date_mutation)
        .sort((a, b) => new Date(b.date_mutation) - new Date(a.date_mutation))
        .slice(0, 5);
    
    if (transactionsSorted.length > 0) {
        html += `<div class="section-title">📝 Transactions récentes</div>`;
        
        transactionsSorted.forEach(t => {
            const surfaceTrans = parseFloat(t.surface_reelle_bati || t.surface_terrain);
            const valeur = parseFloat(t.valeur_fonciere);
            const prixM2Trans = valeur / surfaceTrans;
            
            const adresseTransaction = t.adresse_numero && t.adresse_nom_voie 
                ? `${t.adresse_numero} ${t.adresse_nom_voie}` 
                : (t.adresse_nom_voie || 'Adresse non disponible');
            
            html += `
                <div class="transaction">
                    <div class="transaction-header">
                        <span class="transaction-date">${formatDate(t.date_mutation)}</span>
                        <span class="transaction-price">${formatPrice(prixM2Trans)}/m²</span>
                    </div>
                    <div class="transaction-details">
                        Prix: ${formatPrice(valeur)} | Surface: ${surfaceTrans.toFixed(0)} m²<br>
                        ${adresseTransaction}<br>
                        ${t.type_local || typeLocal}
                    </div>
                </div>
            `;
        });
    }
    
    resultsContent.innerHTML = html;
    resultsCard.classList.add('show');
}

function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatPrice(price) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price) + ' €';
}

function formatDiff(diff) {
    const sign = diff >= 0 ? '+' : '';
    return sign + formatPrice(Math.abs(diff));
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

resetBtn.addEventListener('click', () => {
    resultsCard.classList.remove('show');
    formCard.style.display = 'block';
    form.reset();
    currentAdresseData = null;
});
