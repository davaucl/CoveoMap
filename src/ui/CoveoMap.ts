import {
    Component,
    IComponentBindings,
    QueryEvents,
    IBuildingQueryEventArgs,
    Initialization,
    InitializationEvents,
    IQuerySuccessEventArgs,
    IQueryResult,
} from 'coveo-search-ui';

export class CoveoMap extends Component {
    static ID = 'Map';
    private googleMap: google.maps.Map;
    private backgroundMarkers: {[key: string]: google.maps.Marker};
    private cluster: MarkerClusterer;

    constructor(public element: HTMLElement, public bindings: IComponentBindings) {
        super(element, CoveoMap.ID, bindings);
        this.backgroundMarkers = {};
        this.bind.onRootElement(QueryEvents.buildingQuery, (args: IBuildingQueryEventArgs) => this.onBuildingQuery(args));
        this.bind.onRootElement(QueryEvents.querySuccess, (args: IQuerySuccessEventArgs) => this.onQuerySuccess(args));
        this.bind.onRootElement(InitializationEvents.afterInitialization, () => this.initMap());
    }

    private onQuerySuccess(args: IQuerySuccessEventArgs) {
        this.clearRelevantMarker();
        this.plotItem(args);
    }

    private onBuildingQuery(args: IBuildingQueryEventArgs) {
        if (this.searchInterface.queryController.firstQuery) {
            args.queryBuilder.numberOfResults = 1000;
        }
    }

    private initMap() {
        this.googleMap = new google.maps.Map(this.element, {
            center: { lat: -33.839, lng: 151.211},
            zoom: 12
        });
    }

    private plotItem(args: IQuerySuccessEventArgs) {
        for (const result of args.results.results) {
            const marker = this.getMarker(result);
            marker.setOpacity(1);
        }
        if (args.results.results[0]) {
            this.centerMapOnPoint(args.results.results[0]);
        }
    }

    private getMarker(result) {
        const key = result.raw.sysrowid;
        if (!this.backgroundMarkers[key]) {
            const resultPosition = { lat: result.raw.latitude, lng: result.raw.longitude };
            const marker = new google.maps.Marker({
                position: resultPosition
            });
            marker.setMap(this.googleMap);
            this.backgroundMarkers[key] = marker;
        }
        return this.backgroundMarkers[key];
    }

    private clearRelevantMarker() {
        Object.keys(this.backgroundMarkers).forEach((key) => {
            this.backgroundMarkers[key].setOpacity(0.2);
        });
    }

    private centerMapOnPoint(resultPosition: IQueryResult) {
        this.googleMap.setCenter({lat: resultPosition.raw.latitude, lng: resultPosition.raw.longitude});
    }
}

Initialization.registerAutoCreateComponent(CoveoMap);
