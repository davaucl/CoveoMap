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
        this.cluster = new MarkerClusterer(this.googleMap, this.markersToCluster, { imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m' });
    }

    private initMap() {
        this.googleMap = new google.maps.Map(this.element, {
            center: { lat: -33.839, lng: 151.211 },
            zoom: 12
        });
        const contentString = '<div id="content">' +
            '<div id="siteNotice">' +
            '</div>' +
            '<h1 id="firstHeading" class="firstHeading">Uluru</h1>' +
            '<div id="bodyContent">' +
            '<p><b>Uluru</b>, also referred to as <b>Ayers Rock</b>, is a large ' +
            'sandstone rock formation in the southern part of the ' +
            'Northern Territory, central Australia. It lies 335&#160;km (208&#160;mi) ' +
            'south west of the nearest large town, Alice Springs; 450&#160;km ' +
            '(280&#160;mi) by road. Kata Tjuta and Uluru are the two major ' +
            'features of the Uluru - Kata Tjuta National Park. Uluru is ' +
            'sacred to the Pitjantjatjara and Yankunytjatjara, the ' +
            'Aboriginal people of the area. It has many springs, waterholes, ' +
            'rock caves and ancient paintings. Uluru is listed as a World ' +
            'Heritage Site.</p>' +
            '<p>Attribution: Uluru, <a href="https://en.wikipedia.org/w/index.php?title=Uluru&oldid=297882194">' +
            'https://en.wikipedia.org/w/index.php?title=Uluru</a> ' +
            '(last visited June 22, 2009).</p>' +
            '</div>' +
            '</div>';

        this.infoWindow = new google.maps.InfoWindow({
            content: contentString
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

    private getMarker(result) {
        const key = result.raw.sysrowid;
        if (!this.markers[key]) {
            const resultPosition = { lat: result.raw.latitude, lng: result.raw.longitude };
            const marker = new google.maps.Marker({
                position: resultPosition
            });
            marker.addListener('click', () => {
                this.infoWindow.open(this.googleMap, marker);
            });
            marker.setMap(this.googleMap);
            this.markers[key] = marker;
        }
        return this.markers[key];
    }

    private clearRelevantMarker() {
        Object.keys(this.markers).forEach((key) => {
            this.markers[key].setOpacity(0.3);
        });
    }

    private centerMapOnPoint(resultPosition: IQueryResult) {
        this.googleMap.setCenter({ lat: resultPosition.raw.latitude, lng: resultPosition.raw.longitude });
    }
}

Initialization.registerAutoCreateComponent(CoveoMap);
