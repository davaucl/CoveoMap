import {
    Component,
    IComponentBindings,
    QueryEvents,
    IBuildingQueryEventArgs,
    Initialization,
    InitializationEvents,
    IQuerySuccessEventArgs,
    IQueryResult,
    result,
} from 'coveo-search-ui';

export class CoveoMap extends Component {
    static ID = 'Map';
    private googleMap: google.maps.Map;
    private markers: { [key: string]: google.maps.Marker };
    private cluster: MarkerClusterer;
    private markersToCluster = [];
    private infoWindow: google.maps.InfoWindow;
    private popUpInfo = '';

    constructor(public element: HTMLElement, public bindings: IComponentBindings) {
        super(element, CoveoMap.ID, bindings);
        this.markers = {};
        this.bind.onRootElement(QueryEvents.buildingQuery, (args: IBuildingQueryEventArgs) => this.onBuildingQuery(args));
        this.bind.onRootElement(QueryEvents.querySuccess, (args: IQuerySuccessEventArgs) => this.onQuerySuccess(args));
        this.bind.onRootElement(InitializationEvents.afterInitialization, () => this.initMap());
    }

    private onQuerySuccess(args: IQuerySuccessEventArgs) {
        this.clearRelevantMarker();
        this.plotItem(args);
        this.initCluster(args);
    }

    private onBuildingQuery(args: IBuildingQueryEventArgs) {
        if (this.searchInterface.queryController.firstQuery) {
            args.queryBuilder.numberOfResults = 1000;
        }
    }

    private initCluster(args: IQuerySuccessEventArgs) {
        this.cluster = new MarkerClusterer(this.googleMap, this.markersToCluster, { imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m', minimumClusterSize: 50 });
    }

    private initMap() {
        this.googleMap = new google.maps.Map(this.element, {
            center: { lat: -33.839, lng: 151.211 },
            zoom: 12
        });
    }

    private plotItem(args: IQuerySuccessEventArgs) {
        for (const result of args.results.results) {
            const marker = this.getMarker(result);
            marker.setOpacity(1);
            this.markersToCluster.push(marker);
        }
        if (args.results.results[0]) {
            this.centerMapOnPoint(args.results.results[0]);
        }
    }

    private populateInfoWindow(result: IQueryResult) {
        this.infoWindow = new google.maps.InfoWindow({
            content : '<h2>' + result.raw.businessname + '</h2>' + '<div>' + result.raw.streetname + '<br>' + result.raw.city + '<br>'  + result.raw.state + '<br>' + result.raw.phone + '</div>'
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
        marker.setMap(this.googleMap);
        return marker;
    }

    private clearRelevantMarker() {
        Object.keys(this.markers).forEach((key) => {
            this.markers[key].setOpacity(0.1);
        });
    }

    private centerMapOnPoint(resultPosition: IQueryResult) {
        this.googleMap.setCenter({ lat: resultPosition.raw.latitude, lng: resultPosition.raw.longitude });
    }
}

Initialization.registerAutoCreateComponent(CoveoMap);
