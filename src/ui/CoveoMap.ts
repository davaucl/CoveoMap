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
    IQueryBuilderExpression,
    ExpressionBuilder,
} from 'coveo-search-ui';

export class CoveoMap extends Component {
    static ID = 'Map';
    private googleMap: google.maps.Map;
    private markers: { [key: string]: google.maps.Marker };
    private cluster: MarkerClusterer;
    private markersToCluster = [];
    private infoWindow: google.maps.InfoWindow;

    constructor(public element: HTMLElement, public bindings: IComponentBindings) {
        super(element, CoveoMap.ID, bindings);
        this.markers = {};
        this.bind.onRootElement(QueryEvents.buildingQuery, (args: IBuildingQueryEventArgs) => this.onBuildingQuery(args));
        this.bind.onRootElement(QueryEvents.querySuccess, (args: IQuerySuccessEventArgs) => this.onQuerySuccess(args));
        this.bind.onRootElement(InitializationEvents.afterInitialization, () => this.initMap());
    }

    private onQuerySuccess(args: IQuerySuccessEventArgs) {
        this.clearRelevantMarker();
        this.plotItem(args.results);
        this.initCluster(args);
    }

    private onBuildingQuery(args: IBuildingQueryEventArgs) {
    }

    private initCluster(args: IQuerySuccessEventArgs) {
        this.cluster = new MarkerClusterer(this.googleMap, this.markersToCluster, { imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m', minimumClusterSize: 40 });
    }

    private initMap() {
        this.googleMap = new google.maps.Map(this.element, {
            center: { lat: -33.839, lng: 151.211 },
            zoom: 12
        });
        this.getPersistentMarkers();
    }

    private getPersistentMarkers() {
        Coveo.SearchEndpoint.endpoints.default.search({ q: '', numberOfResults: 1000, pipeline: 'persistent' }).then((results) => this.plotItem(results));
    }

    private plotItem(args: IQueryResults) {
        for (const result of args.results) {
            const marker = this.getMarker(result);
            marker.setOpacity(1);
            this.focusOnMarker(args.results[0].raw.markerId);
            this.markersToCluster.push(marker);
        }
    }

    private populateInfoWindow(result: IQueryResult) {
        this.infoWindow = new google.maps.InfoWindow({
            content : '<h2>' + result.raw.businessname + '</h2>' + '</h2>' + '<h3>$' + result.raw.price.toLocaleString() + '</h3><br>' + result.raw.city + '<br>'  + result.raw.state + '<br>' + result.raw.phone
        });
    }

    private getMarker(result: IQueryResult) {
        const key = result.raw.sysrowid;
        if (!this.markers[key]) {
            this.markers[key] = this.createMarker(result);
        }
        return this.markers[key];
    }

    private createMarker(result: IQueryResult) {
        const resultPosition = { lat: result.raw.latitude, lng: result.raw.longitude };
        const marker = new google.maps.Marker({
            position: resultPosition
        });
        marker.addListener('click', () => {
            this.populateInfoWindow(result);
            this.infoWindow.open(this.googleMap, marker);
        });
        marker.set('mapuniqid', result.raw.mapuniqid);
        marker.setMap(this.googleMap);
        return marker;
    }

    private clearRelevantMarker() {
        Object.keys(this.markers).forEach((key) => {
            this.markers[key].setOpacity(0.2);
        });
    }

    private setZoomLevel(zoomLevel) {
        this.googleMap.setZoom(zoomLevel);
    }

    public focusOnMarker(uniqueId) {
        if (this.infoWindow) {
            this.infoWindow.close();
        }
        Object.keys(this.markers).forEach((key) => {
            if (this.markers[key]['mapuniqid'] == uniqueId) {
                this.setZoomLevel(19);
                this.centerMapOnPoint(this.markers[key].getPosition()['lat'](), this.markers[key].getPosition()['lng']());
                google.maps.event.trigger(this.markers[key], 'click');
            }
        });
        document.getElementById('CoveoMap').scrollIntoView();
    }

    public centerMapOnPoint(latitude, longitude) {
        this.googleMap.setCenter({ lat: latitude + 0.01, lng: longitude });
    }
}

Initialization.registerAutoCreateComponent(CoveoMap);
