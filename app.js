function afficherResultats(adresseData, typeLocal, prix, surface, transactions, memeRue) {
    let html = `
        <div class="info">
            <strong>📍 ${adresseData.label}</strong><br>
            Type: ${typeLocal} | Surface: ${surface} m²<br>
            Prix: ${formatPrice(prix)}
        </div>
        
        <div class="section-title">📝 Liste des transactions (${transactions.length})</div>
    `;
    
    // Afficher TOUTES les transactions en liste
    transactions.forEach((t, index) => {
        const surfaceTrans = parseFloat(t.surface_reelle_bati || t.surface_terrain || 0);
        const valeur = parseFloat(t.valeur_fonciere || 0);
        const prixM2Trans = surfaceTrans > 0 ? valeur / surfaceTrans : 0;
        
        const adresseTransaction = t.adresse_numero && t.adresse_nom_voie 
            ? `${t.adresse_numero} ${t.adresse_nom_voie}` 
            : (t.adresse_nom_voie || 'Adresse non disponible');
        
        html += `
            <div class="transaction">
                <div class="transaction-header">
                    <span class="transaction-date">#${index + 1} - ${formatDate(t.date_mutation)}</span>
                    <span class="transaction-price">${formatPrice(prixM2Trans)}/m²</span>
                </div>
                <div class="transaction-details">
                    Prix: ${formatPrice(valeur)} | Surface: ${surfaceTrans.toFixed(1)} m²<br>
                    ${adresseTransaction}<br>
                    ${t.type_local || typeLocal}
                </div>
            </div>
        `;
    });
    
    resultsContent.innerHTML = html;
    resultsCard.classList.add('show');
}