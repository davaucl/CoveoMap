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
    DefaultResultTemplate,
    TemplateCache,
    TemplateList,
    TemplateComponentOptions,
} from 'coveo-search-ui';

export interface ICoveoMapOptions {
    infoWindowTemplate: Template;
  }

export class CoveoMap extends Component {
    static ID = 'Map';
    static options: ICoveoMapOptions = {
        infoWindowTemplate: ComponentOptions.buildTemplateOption({idAttr: '#CoveoMapResultTemplate'})
    };

    private googleMap: google.maps.Map;
    private markers: { [key: string]: google.maps.Marker };
    private cluster: MarkerClusterer;
    private markersToCluster = [];
    private infoWindow: google.maps.InfoWindow;

    constructor(public element: HTMLElement, public options: ICoveoMapOptions,  public bindings: IComponentBindings) {
        super(element, CoveoMap.ID, bindings);
        this.options = ComponentOptions.initComponentOptions(element, CoveoMap, options);
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
        const queryBuilder = args.queryBuilder;
        const currentLatitude = this.googleMap.getCenter()['lat']();
        const currentLongitude = this.googleMap.getCenter()['lng']();
        queryBuilder.advancedExpression.add('$qf(function:\'dist(@latitude, @longitude,' + currentLatitude + ',' + currentLongitude + ')/1000\', fieldName: \'distance\')');
        queryBuilder.advancedExpression.add('$qrf(expression:\'300 - @distance\', normalizeWeight: true)');
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
            this.markersToCluster.push(marker);
        }
        if (args.pipeline != 'persistent') {
            this.focusOnMarker(args.results[0].raw.markerid);
        }
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
            if (this.infoWindow) {
                this.infoWindow.close();
            }
            this.populateInfoWindow(result);
            this.infoWindow.open(this.googleMap, marker);
        });
        marker.set('markerid', result.raw.markerid);
        marker.setMap(this.googleMap);
        return marker;
    }

    private populateInfoWindow(result: IQueryResult) {
        this.infoWindow = new google.maps.InfoWindow({
            content : '<H3>' + result.raw.businessname + '</H3>' + '<h4> in ' + result.raw.city + ', ' + result.raw.state + '</h4>'
        });
    }

    private clearRelevantMarker() {
        Object.keys(this.markers).forEach((key) => {
            this.markers[key].setOpacity(0.3);
        });
    }

    private setZoomLevel(zoomLevel) {
        this.googleMap.setZoom(zoomLevel);
    }

    public centerMapOnPoint(latitude, longitude) {
        this.googleMap.setCenter({ lat: latitude + 0.015, lng: longitude });
    }

    public focusOnMarker(markerid) {
        Object.keys(this.markers).forEach((key) => {
            if (this.markers[key]['markerid'] == markerid) {
                // this.setZoomLevel(14);
                this.centerMapOnPoint(this.markers[key].getPosition()['lat'](), this.markers[key].getPosition()['lng']());
                google.maps.event.trigger(this.markers[key], 'click');
            }
        });
        document.getElementById('CoveoMap').scrollIntoView();
    }
}

Initialization.registerAutoCreateComponent(CoveoMap);
