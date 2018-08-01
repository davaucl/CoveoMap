import {
    Component,
    IComponentBindings,
    QueryEvents,
    IBuildingQueryEventArgs,
    Initialization,
    InitializationEvents,
    IQuerySuccessEventArgs,
    IQueryResult,
    ComponentOptions,
    Template,
    TemplateCache
} from 'coveo-search-ui';

export interface ICoveoMapOptions {
    template: Template;
}

/**
 * Interface used to combine Google Map Markers, Google Info Window
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
 * The Coveo Map component Class, extending the Coveo Framework Component
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

    constructor(public element: HTMLElement, public options: ICoveoMapOptions, public bindings: IComponentBindings) {
        super(element, CoveoMap.ID, bindings);
        this.options = ComponentOptions.initComponentOptions(element, CoveoMap, options);
        this.resultMarkers = {};
        this.bind.onRootElement(QueryEvents.buildingQuery, (args: IBuildingQueryEventArgs) => this.onBuildingQuery(args));
        this.bind.onRootElement(QueryEvents.querySuccess, (args: IQuerySuccessEventArgs) => this.onQuerySuccess(args));
        this.bind.onRootElement(InitializationEvents.afterInitialization, () => this.initMap());
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
        queryBuilder.advancedExpression.add(`$qf(function:'dist(@latitude, @longitude, ${currentLatitude}, ${currentLongitude})/1000', fieldName: 'distance')`);
        // adjust item score based on their distance
        queryBuilder.advancedExpression.add(`$qrf(expression:'(500-@distance^0.72)')`);
        // adjust item score based on their rankings
        queryBuilder.advancedExpression.add(`$qrf(expression:'@ratings*5')`);
    }

    private onQuerySuccess(args: IQuerySuccessEventArgs) {
        this.closeAllInfoWindows();
        this.clearRelevantMarker();
        args.results.results.forEach(result => {
            const resultMarker = this.plotItem(result);
            this.plotItemAsRelevant(resultMarker);
        });
    }

    private getPersistentMarkers() {
        // Get 1000 results to load background items on the map. The call is using the Search Endpoint directly.
        Coveo.SearchEndpoint.endpoints.default.search({ q: '', numberOfResults: 1000, pipeline: 'persistent' }).then((results) => {
            // Get 1000 results to load background items on the map.
            results.results.forEach(result => {
                result.searchInterface = this.searchInterface;
                result.index = 101;
                this.plotItem(result);
            });
        });
    }

    private plotItem(result: IQueryResult): IResultMarker {
        const resultMarker = this.getResultMarker(result);
        resultMarker.result = result;
        this.setMarkerAsBackground(resultMarker.marker);
        return resultMarker;
    }

    private plotItemAsRelevant(resultMarker: IResultMarker) {
        this.setMarkerAsRelevant(resultMarker.marker);
        if (resultMarker.result.index == 0) {
            this.centerMapOnPoint(resultMarker.result.raw.latitude, resultMarker.result.raw.longitude);
        }
    }

    private setMarkerAsRelevant(marker: google.maps.Marker) {
        marker.setIcon('http://www.osteokinesis.it/img/icons/map-marker.png');
        marker.setOpacity(1);
        marker.setZIndex(100);
    }

    private setMarkerAsBackground(marker: google.maps.Marker) {
        marker.setIcon(null);
        marker.setOpacity(0.2);
        marker.setZIndex(50);
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

    private instantiateTemplate(result: IQueryResult): Promise<HTMLElement> {
        return this.options.template.instantiateToElement(result).then(element => {
            Component.bindResultToElement(element, result);
            return Initialization.automaticallyCreateComponentsInsideResult(element, result)
                .initResult.then(() => element);
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
            this.setMarkerAsBackground(marker);
        });
    }

    private sendClickEvent(resultMarker: IResultMarker) {
        const customEventCause = { name: 'Click', type: 'document' };
        const { marker, result } = resultMarker;
        const isRelevant = marker.getOpacity() != 1;
        const metadata = {
            relevantMarker: isRelevant,
            department: result.raw.department,
            businessname: result.raw.businessname,
            city: result.raw.city,
            state: result.raw.state,
            price: result.raw.price
        };
        this.usageAnalytics.logClickEvent(customEventCause, metadata, result, this.element);
    }

    private centerMapOnPoint(lat, lng) {
        const scale = Math.pow(2, this.googleMap.getZoom());
        const latLng = new google.maps.LatLng(lat, lng);
        const mapCenter = this.googleMap.getProjection().fromLatLngToPoint(latLng);
        const pixelOffset = new google.maps.Point((0 / scale) || 0, (-200 / scale) || 0);
        const worldCoordinateNewCenter = new google.maps.Point(
            mapCenter.x - pixelOffset.x,
            mapCenter.y + pixelOffset.y
        );
        const newCenter = this.googleMap.getProjection().fromPointToLatLng(worldCoordinateNewCenter);
        this.googleMap.setCenter(newCenter);
    }

    public focusOnMarker(markerId: string) {
        Object.keys(this.resultMarkers)
            .filter(key => this.resultMarkers[key].id == markerId)
            .forEach((key) => {
                const { marker } = this.resultMarkers[key];
                const { lat, lng } = marker.getPosition().toJSON();
                this.centerMapOnPoint(lat, lng);
                google.maps.event.trigger(marker, 'click');
                marker.setAnimation(google.maps.Animation.DROP);
            });
        window.scroll({ top: 0, left: 0, behavior: 'smooth' });
    }

}

Initialization.registerAutoCreateComponent(CoveoMap);
