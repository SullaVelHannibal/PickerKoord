// mapCoordPicker.js
// ==UserScript==
// @name         Map Coord Picker (SPOL)
// @namespace    https://github.com/TwojNick
// @version      v2.2.0-extended
// @description  Wybieranie współrzędnych z mapy – spolszczona wersja z możliwością rysowania obszaru na mapie i pobierania współrzędnych wiosek.
// @author       RedAlert (oryg.) / JawJaw (mod) / Twój pomocnik
// @include      *://*.plemiona.pl/game.php?*&screen=map*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Deklaracja zmiennej DEBUG, aby uniknąć błędów
    var DEBUG = false;

    // Funkcja, która zawiera główną logikę skryptu – uruchomiona gdy twSDK będzie dostępne
    function initScript() {
        var scriptConfig = {
            scriptData: {
                prefix: 'mapCoordPicker',
                name: 'Map Coord Picker',
                version: 'v2.2.0',
                author: 'RedAlert',
                authorUrl: 'https://twscripts.dev/',
                helpLink: 'https://forum.tribalwars.net/index.php?threads/map-coords-picker.285565/',
            },
            translations: {
                pl_PL: {
                    'Map Coord Picker': 'Wybieranie współrzędnych z mapy',
                    Help: 'Pomoc',
                    'Redirecting...': 'Przekierowywanie...',
                    Reset: 'Resetuj',
                    Copy: 'Kopiuj',
                    'Copy with ID': 'Kopiuj z ID',
                    'Copied!': 'Skopiowano!',
                    'Nothing to be copied!': 'Nic do skopiowania!',
                    'Selection cleared!': 'Zaznaczenie wyczyszczone!',
                    'Selected villages:': 'Wybrane wioski:',
                    Highlight: 'Podświetl',
                    'Fill the coordinates field!': 'Wypełnij pole współrzędnych!',
                    'Coordinates have been highlighted!': 'Współrzędne zostały podświetlone!',
                    'Draw area': 'Rysuj obszar',
                    'Area drawn! Selected villages:': 'Obszar zaznaczony! Wybrano wiosek:',
                },
            },
            allowedMarkets: [],
            allowedScreens: ['map'],
            allowedModes: [],
            isDebug: DEBUG,
            enableCountApi: true,
        };

        // Zakładamy, że twSDK, jQuery, TWMap oraz UI są dostępne
        var mapOverlay;
        var selectedVillages = [];
        if ('TWMap' in window) mapOverlay = TWMap;

        (function () {
            if (twSDK && twSDK.checkValidLocation('screen')) {
                buildUI();
                mapOverlay.mapHandler._spawnSector = mapOverlay.mapHandler.spawnSector;
                TWMap.mapHandler.spawnSector = spawnSectorReplacer;
                mapOverlay.map._DShandleClick = mapOverlay.map._handleClick;
                handleReset();
                handleCopy();
                handleCopyWithId();
                handleMapClick();
                handleHighlight();
                handleDrawArea();
            } else {
                UI.InfoMessage(twSDK.tt('Redirecting...'));
                twSDK.redirectTo('map');
            }
        })();

        function buildUI() {
            const t = twSDK.tt;
            const content = `
                <div class="ra-mb15">
                    <label for="villageList" class="ra-label">
                        ${t('Selected villages:')} <span id="countSelectedVillages">0</span>
                    </label>
                    <textarea id="villageList" class="ra-textarea"></textarea>
                </div>
                <div class="ra-mb15">
                    <a href="javascript:void(0);" class="btn" id="raResetBtn">${t('Reset')}</a>
                    <a href="javascript:void(0);" class="btn" id="raCopyBtn">${t('Copy')}</a>
                    <a href="javascript:void(0);" class="btn" id="raCopyWithIdBtn">${t('Copy with ID')}</a>
                    <a href="javascript:void(0);" class="btn" id="raHighlightBtn">${t('Highlight')}</a>
                    <a href="javascript:void(0);" class="btn" id="raDrawAreaBtn">${t('Draw area')}</a>
                </div>
            `;
            const customStyle = `.ra-label { display: block; margin-bottom: 5px; font-weight: 600; }`;
            twSDK.renderFixedWidget(content, scriptConfig.scriptData.prefix, 'ra-map-coord-picker', customStyle);
        }

        function handleReset() {
            jQuery('#raResetBtn').on('click', function (e) {
                e.preventDefault();
                selectedVillages = [];
                jQuery('#villageList').val('');
                jQuery('#countSelectedVillages').text('0');
                TWMap.reload();
                UI.SuccessMessage(twSDK.tt('Selection cleared!'));
            });
        }

        function handleCopy() {
            jQuery('#raCopyBtn').on('click', function (e) {
                e.preventDefault();
                const coords = jQuery('#villageList').val().trim();
                if (coords.length !== 0) {
                    jQuery('#villageList').select();
                    document.execCommand('copy');
                    UI.SuccessMessage(twSDK.tt('Copied!'), 4000);
                } else {
                    UI.ErrorMessage(twSDK.tt('Nothing to be copied!'), 4000);
                }
            });
        }

        function handleCopyWithId() {
            jQuery('#raCopyWithIdBtn').on('click', async function (e) {
                e.preventDefault();
                const coords = jQuery('#villageList').val().trim();
                if (coords.length !== 0) {
                    const { villages } = await fetchWorldConfigData();
                    const filteredVillages = villages.filter((village) => {
                        const villageCoord = village[2] + '|' + village[3];
                        return coords.includes(villageCoord);
                    });
                    const coordsWithId = filteredVillages
                        .map((village) => `${village[2]}|${village[3]}:${village[0]}`)
                        .join(' ');
                    if (coordsWithId.trim().length !== 0) {
                        twSDK.copyToClipboard(coordsWithId);
                        UI.SuccessMessage(twSDK.tt('Copied!'), 4000);
                    } else {
                        UI.ErrorMessage(twSDK.tt('Nothing to be copied!'), 4000);
                    }
                } else {
                    UI.ErrorMessage(twSDK.tt('Nothing to be copied!'), 4000);
                }
            });
        }

        function handleMapClick() {
            TWMap.map._handleClick = function (e) {
                let currentCoords = jQuery('#villageList').val();
                let pos = this.coordByEvent(e);
                let coord = pos.join('|');
                let village = TWMap.villages[pos[0] * 1000 + pos[1]];
                if (village && village.id) {
                    if (!currentCoords.includes(coord)) {
                        jQuery(`[id="map_village_${village.id}"]`).css({
                            filter: 'brightness(200%) grayscale(100%)',
                        });
                        selectedVillages.push(coord);
                        jQuery('#villageList').val(selectedVillages.join(' '));
                        jQuery('#countSelectedVillages').text(selectedVillages.length);
                    } else {
                        selectedVillages = selectedVillages.filter((v) => v !== coord);
                        jQuery('#villageList').val(selectedVillages.join(' '));
                        jQuery(`[id="map_village_${village.id}"]`).css({ filter: 'none' });
                        jQuery('#countSelectedVillages').text(selectedVillages.length);
                    }
                }
                return false;
            };
        }

        function handleHighlight() {
            jQuery('#raHighlightBtn').on('click', function (e) {
                e.preventDefault();
                const chosenCoords = jQuery('#villageList').val().trim();
                if (chosenCoords.length !== 0) {
                    const coordsArray = chosenCoords.split(' ');
                    updateMap(coordsArray);
                    UI.SuccessMessage(twSDK.tt('Coordinates have been highlighted!'));
                } else {
                    UI.ErrorMessage(twSDK.tt('Fill the coordinates field!'));
                }
            });
        }

        function handleDrawArea() {
            jQuery('#raDrawAreaBtn').on('click', function (e) {
                e.preventDefault();
                UI.InfoMessage("Kliknij i przeciągnij, aby zaznaczyć obszar na mapie");
                const mapElem = jQuery(TWMap.map.container);
                let startCoords, endCoords;
                const drawingRect = jQuery('<div id="drawingRect"></div>').css({
                    position: 'absolute',
                    border: '2px dashed red',
                    background: 'rgba(255,0,0,0.2)',
                    pointerEvents: 'none',
                });
                mapElem.append(drawingRect);
                mapElem.one('mousedown.drawArea', function (e) {
                    startCoords = TWMap.map.coordByEvent(e);
                    const offset = mapElem.offset();
                    const startX = e.pageX - offset.left;
                    const startY = e.pageY - offset.top;
                    drawingRect.css({
                        left: startX,
                        top: startY,
                        width: 0,
                        height: 0,
                    });
                    mapElem.on('mousemove.drawArea', function (e) {
                        const currentX = e.pageX - offset.left;
                        const currentY = e.pageY - offset.top;
                        const rectLeft = Math.min(startX, currentX);
                        const rectTop = Math.min(startY, currentY);
                        const rectWidth = Math.abs(currentX - startX);
                        const rectHeight = Math.abs(currentY - startY);
                        drawingRect.css({
                            left: rectLeft,
                            top: rectTop,
                            width: rectWidth,
                            height: rectHeight,
                        });
                    });
                    mapElem.one('mouseup.drawArea', function (e) {
                        mapElem.off('mousemove.drawArea');
                        endCoords = TWMap.map.coordByEvent(e);
                        drawingRect.remove();
                        const xMin = Math.min(startCoords[0], endCoords[0]);
                        const xMax = Math.max(startCoords[0], endCoords[0]);
                        const yMin = Math.min(startCoords[1], endCoords[1]);
                        const yMax = Math.max(startCoords[1], endCoords[1]);
                        let selected = [];
                        for (let key in TWMap.villages) {
                            const village = TWMap.villages[key];
                            if (village && village.xy) {
                                const x = parseInt(village.xy.slice(0, 3), 10);
                                const y = parseInt(village.xy.slice(3, 6), 10);
                                if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
                                    selected.push(x + '|' + y);
                                }
                            }
                        }
                        jQuery('#villageList').val(selected.join(' '));
                        jQuery('#countSelectedVillages').text(selected.length);
                        UI.SuccessMessage(twSDK.tt('Area drawn! Selected villages:') + ' ' + selected.length);
                    });
                });
            });
        }

        function updateMap(villageCoords) {
            if (!mapOverlay.mapHandler._spawnSector) {
                mapOverlay.mapHandler._spawnSector = mapOverlay.mapHandler.spawnSector;
            }
            TWMap.mapHandler.spawnSector = function (data, sector) {
                mapOverlay.mapHandler._spawnSector(data, sector);
                const beginX = sector.x - data.x;
                const beginY = sector.y - data.y;
                const endX = beginX + mapOverlay.mapSubSectorSize;
                const endY = beginY + mapOverlay.mapSubSectorSize;
                for (let x in data.tiles) {
                    const xi = parseInt(x, 10);
                    if (xi < beginX || xi >= endX) continue;
                    for (let y in data.tiles[x]) {
                        const yi = parseInt(y, 10);
                        if (yi < beginY || yi >= endY) continue;
                        const v = TWMap.villages[(data.x + xi) * 1000 + (data.y + yi)];
                        if (v) {
                            const vXY = '' + v.xy;
                            const vCoords = vXY.slice(0, 3) + '|' + vXY.slice(3, 6);
                            if (villageCoords.includes(vCoords)) {
                                const eleDIV = jQuery('<div></div>').css({
                                    position: 'absolute',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    padding: '1px',
                                    backgroundColor: 'rgba(187,255,0,0.7)',
                                    color: '#fff',
                                    width: '50px',
                                    height: '35px',
                                    zIndex: '10',
                                    fontSize: '10px',
                                }).attr('id', 'dsm' + v.id);
                                sector.appendElement(eleDIV[0], data.x + xi - sector.x, data.y + yi - sector.y);
                            }
                        }
                    }
                }
            };
            TWMap.reload();
        }

        function spawnSectorReplacer(data, sector) {
            mapOverlay.mapHandler._spawnSector(data, sector);
            const beginX = sector.x - data.x;
            const beginY = sector.y - data.y;
            const endX = beginX + mapOverlay.mapSubSectorSize;
            const endY = beginY + mapOverlay.mapSubSectorSize;
            for (let x in data.tiles) {
                const xi = parseInt(x, 10);
                if (xi < beginX || xi >= endX) continue;
                for (let y in data.tiles[x]) {
                    const yi = parseInt(y, 10);
                    if (yi < beginY || yi >= endY) continue;
                    const v = TWMap.villages[(data.x + xi) * 1000 + (data.y + yi)];
                    if (v && selectedVillages.length > 0) {
                        const vXY = '' + v.xy;
                        const vCoords = vXY.slice(0, 3) + '|' + vXY.slice(3, 6);
                        if (selectedVillages.includes(vCoords)) {
                            jQuery(`[id="map_village_${v.id}"]`).css({ filter: 'brightness(200%) grayscale(100%)' });
                        }
                    }
                }
            }
        }

        async function fetchWorldConfigData() {
            try {
                const villages = await twSDK.worldDataAPI('village');
                return { villages };
            } catch (error) {
                UI.ErrorMessage(twSDK.tt('There was an error while fetching the data!'));
                console.error('Error:', error);
            }
        }

        function numberWithCommas(x) {
            x = x.toString();
            var pattern = /(-?\d+)(\d{3})/;
            while (pattern.test(x))
                x = x.replace(pattern, "$1.$2");
            return x;
        }

        function sliderChange(name, val) {
            document.getElementById(name).innerHTML = val;
        }

        function saveSettings() {
            var tempArray = jQuery("#settings").serializeArray();
            if (jQuery("input[name='isMinting']")[0].checked === true) {
                settings.isMinting = true;
                settings.lowPoints = parseInt(tempArray[1].value);
                settings.highPoints = parseInt(tempArray[2].value);
                settings.highFarm = parseInt(tempArray[3].value);
                settings.builtOutPercentage = parseFloat(tempArray[4].value);
                settings.needsMorePercentage = parseFloat(tempArray[5].value);
            } else {
                settings.isMinting = false;
                settings.lowPoints = parseInt(tempArray[0].value);
                settings.highPoints = parseInt(tempArray[1].value);
                settings.highFarm = parseInt(tempArray[2].value);
                settings.builtOutPercentage = parseFloat(tempArray[3].value);
                settings.needsMorePercentage = parseFloat(tempArray[4].value);
            }
            localStorage.setItem("settingsWHBalancerSophie", JSON.stringify(settings));
            jQuery(".flex-container").remove();
            jQuery("div[id*='restart']").remove();
            jQuery("div[id*='sendResources']").remove();
            init();
            displayEverything();
        }

        function getTimeInSeconds(timeStr) {
            const parts = timeStr.split(":");
            if (parts.length !== 3) return 0;
            return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
        }

        displayEverything();
    }

    function waitForSDK() {
        if (typeof twSDK !== 'undefined') {
            initScript();
        } else {
            setTimeout(waitForSDK, 100);
        }
    }
    
    waitForSDK();
})();

