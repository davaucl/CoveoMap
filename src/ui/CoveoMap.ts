import {
    Component,
    IComponentBindings,
    QueryEvents,
    IBuildingQueryEventArgs,
    Initialization,
    InitializationEvents,
    IQuerySuccessEventArgs,
    IQueryResult,
    IQueryResults,
    ComponentOptions,
    Template,
    TemplateCache
} from 'coveo-search-ui';

export interface ICoveoMapOptions {
    template: Template;
}

/**
 * Interface used to combine Google Map Markers, their Info Window
 * and the corresponding Coveo Results
 */
interface IResultMarker {
    id: string;
    result: IQueryResult;
    marker: google.maps.Marker;
    infoWindow?: google.maps.InfoWindow;
    isOpen: boolean;
}

/**
 * The Coveo Map component, extending the Coveo Framework
 */
export class CoveoMap extends Component {
    static ID = 'Map';
    /**
     * This section will fetch the data-template-id value of the CoveoMap component
     * and will load any Underscore template script available in the SearchInterface node
     * having the matching DOM ID.
     */
    static options: ICoveoMapOptions = {
        template: ComponentOptions.buildTemplateOption({
            defaultFunction: () => TemplateCache.getDefaultTemplate('Default')
        })
    };

    /**
     * The CoveoMap object stores the Google Map object, so all the map functionalities are accessible.
     * All the results are also store in-memory using the Interface defined at the beggining of this file.
     */
    private googleMap: google.maps.Map;
    private resultMarkers: { [key: string]: IResultMarker };

    /**
     * The CoveoMap object stores the Google Map object, so all the map functionalities are accessible.
     */
    constructor(public element: HTMLElement, public options: ICoveoMapOptions, public bindings: IComponentBindings) {
        super(element, CoveoMap.ID, bindings);
        this.options = ComponentOptions.initComponentOptions(element, CoveoMap, options);
        this.resultMarkers = {};
        this.bind.onRootElement(QueryEvents.buildingQuery, (args: IBuildingQueryEventArgs) => this.onBuildingQuery(args));
        this.bind.onRootElement(QueryEvents.querySuccess, (args: IQuerySuccessEventArgs) => this.onQuerySuccess(args));
        this.bind.onRootElement(InitializationEvents.afterInitialization, () => this.initMap());
    }

    private instantiateTemplate(result: IQueryResult): Promise<HTMLElement> {
        return this.options.template.instantiateToElement(result).then(element => {
            Component.bindResultToElement(element, result);
            return Initialization.automaticallyCreateComponentsInsideResult(element, result).initResult.then(() => {
                return element;
            });
        });
    }

    private initMap() {
        this.googleMap = new google.maps.Map(this.element, {
            center: { lat: -33.839, lng: 151.211 },
            zoom: 12
        });
        this.getPersistentMarkers();
    }

    private onBuildingQuery(args: IBuildingQueryEventArgs) {
        const queryBuilder = args.queryBuilder;
        const currentLatitude = this.googleMap.getCenter()['lat']();
        const currentLongitude = this.googleMap.getCenter()['lng']();
        // get distance for each result relative to the user point of view
        queryBuilder.advancedExpression.add('$qf(function:\'dist(@latitude, @longitude,' + currentLatitude + ',' + currentLongitude + ')/1000\', fieldName: \'distance\')');
        // adjust item score based on distance
        // queryBuilder.advancedExpression.add('$qrf(expression:\'300 - @distance^0.72\')');
        queryBuilder.advancedExpression.add('$qrf(expression:\'(400-@distance^0.72)\')');
        // adjust item score based on ranking
        queryBuilder.advancedExpression.add('$qrf(expression:\'@ratings*5\')');
    }
    private onQuerySuccess(args: IQuerySuccessEventArgs) {
        this.closeAllInfoWindows();
        this.clearRelevantMarker();
        this.plotItem(args.results);
    }

    private getPersistentMarkers() {
        Coveo.SearchEndpoint.endpoints.default.search({ q: '', numberOfResults: 1000, pipeline: 'persistent' }).then((results) => {
            results.results.forEach(result => result.searchInterface = this.searchInterface);
            this.plotItem(results);
        });
    }

    private plotItem(args: IQueryResults) {
        for (const result of args.results) {
            const resultMarker = this.getResultMarker(result);
            resultMarker.result = result;
            resultMarker.marker.setIcon('http://www.osteokinesis.it/img/icons/map-marker.png');
            resultMarker.marker.setOpacity(1);
            if (args.pipeline != 'persistent' && args.totalCount > 0) {
                if (result.index == 0) {
                    this.focusOnMarker(resultMarker.result.raw.markerid);
                }
            }
        }
    }

    private getResultMarker(result: IQueryResult): IResultMarker {
        const key = result.raw.sysrowid;
        if (!this.resultMarkers[key]) {
            this.resultMarkers[key] = this.createResultMarker(result);
        }
        return this.resultMarkers[key];
    }

    private createResultMarker(result: IQueryResult): IResultMarker {
        const marker = this.createMarker(result);

        const resultMarker: IResultMarker = {
            marker, result, isOpen: false, id: result.raw.markerid
        };
        this.attachInfoWindowOnClick(resultMarker);
        return resultMarker;
    }

    private createMarker(result: IQueryResult): google.maps.Marker {
        const marker = new google.maps.Marker({
            position: {
                lat: result.raw.latitude,
                lng: result.raw.longitude
            },
            zIndex: 100
        });
        marker.setMap(this.googleMap);

        return marker;
    }

    private attachInfoWindowOnClick(resultMarker: IResultMarker) {
        const { marker } = resultMarker;
        marker.addListener('click', () => {
            const { result, isOpen } = resultMarker;
            let { infoWindow } = resultMarker;
            if (!infoWindow) {
                infoWindow = new google.maps.InfoWindow({
                    maxWidth: 600
                });
                resultMarker.infoWindow = infoWindow;
            }
            if (!isOpen) {
                this.instantiateTemplate(result).then(element => {
                    this.closeAllInfoWindows();
                    infoWindow.setContent(element);
                    infoWindow.open(this.googleMap, marker);
                    resultMarker.isOpen = true;
                    this.sendClickEvent(resultMarker);
                });
            } else {
                resultMarker.isOpen = false;
                infoWindow.close();
            }
        });
    }

    private closeAllInfoWindows() {
        Object.keys(this.resultMarkers)
            .map(key => this.resultMarkers[key])
            .filter(marker => !!marker.infoWindow)
            .forEach(marker => {
                marker.isOpen = false;
                marker.infoWindow.close();
            });
    }

    private clearRelevantMarker() {
        Object.keys(this.resultMarkers).forEach((key) => {
            const { marker } = this.resultMarkers[key];
            marker.setOpacity(0.2);
            marker.setZIndex(90);
            marker.setIcon(null);
        });
    }

    private sendClickEvent(resultMarker: IResultMarker) {
        const customEventCause = { name: 'Click', type: 'document' };
        let relevant = 'true';
        if (resultMarker.marker.getOpacity() != 1) {
            relevant = 'false';
        }
        const metadata = { relevantMarker: relevant, department: resultMarker.result.raw.department, businessname: resultMarker.result.raw.businessname, city: resultMarker.result.raw.city, state: resultMarker.result.raw.state, price: resultMarker.result.raw.price };
        Coveo.logClickEvent(document.body, customEventCause, metadata, resultMarker.result);
    }

    private setZoomLevel(zoomLevel) {
        this.googleMap.setZoom(zoomLevel);
    }

    public centerMapOnPoint(latitude, longitude) {
        this.googleMap.setCenter({ lat: latitude, lng: longitude });
    }


    public focusOnMarker(markerId: string) {
        Object.keys(this.resultMarkers)
            .filter(key => this.resultMarkers[key].id == markerId)
            .forEach((key) => {
                const { marker } = this.resultMarkers[key];
                // this.setZoomLevel(14);
                const { lat, lng } = marker.getPosition().toJSON();
                this.centerMapOnPoint(lat, lng);
                google.maps.event.trigger(marker, 'click');
                marker.setAnimation(google.maps.Animation.DROP);
                this.sendClickEvent(this.resultMarkers[key]);
            });
        this.element.scrollIntoView();
    }
}

Initialization.registerAutoCreateComponent(CoveoMap);
