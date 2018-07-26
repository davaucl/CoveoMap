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
    TemplateCache,
    QueryController,
    AdvancedSearch,
} from 'coveo-search-ui';

export interface ICoveoMapOptions {
    template: Template;
}

interface IResultMarker {
    result: IQueryResult;
    marker: google.maps.Marker;
    infoWindow?: google.maps.InfoWindow;
    isOpen: boolean;
}

export class CoveoMap extends Component {
    static ID = 'Map';
    static options: ICoveoMapOptions = {
        template: ComponentOptions.buildTemplateOption({
            defaultFunction: () => TemplateCache.getDefaultTemplate('Default')
        })
    };

    private googleMap: google.maps.Map;
    private markers: { [key: string]: google.maps.Marker };
    private infoWindows: google.maps.InfoWindow[] = [];
    private searchArea: boolean;

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
        queryBuilder.advancedExpression.add('$qrf(expression:\'300 - @distance\')');
        // adjust item score based on ranking
        queryBuilder.advancedExpression.add('$qrf(expression:\'@ratings*10\')');
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
            const marker = this.getMarker(result);
            marker.setOpacity(1);
        }
        if (args.pipeline != 'persistent' && args.totalCount > 0) {
            this.focusOnMarker(args.results[0].raw.markerid);
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
            marker, result, isOpen: false
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
            zIndex: 100,
            icon: 'http://www.osteokinesis.it/img/icons/map-marker.png',
        });

        marker.set('markerid', result.raw.markerid);
        marker.setMap(this.googleMap);

        return marker;
    }

    private attachInfoWindowOnClick(resultMarker: IResultMarker) {
        const { marker } = resultMarker;
        marker.addListener('click', () => {
            const { result } = resultMarker;
            let { infoWindow, isOpen } = resultMarker;
            if (!infoWindow) {
                infoWindow = new google.maps.InfoWindow({
                    maxWidth: 600
                });
                this.infoWindows.push(infoWindow);
            }
            if (!isOpen) {
                this.instantiateTemplate(result).then(element => {
                    this.closeAllInfoWindows();
                    infoWindow.setContent(element);
                    infoWindow.open(this.googleMap, marker);
                    isOpen = true;
                });
            } else {
                isOpen = false;
                infoWindow.close();
            }
        });
    }

    private closeAllInfoWindows() {
        this.infoWindows.forEach(oldInfowindow => oldInfowindow.close());
    }

    private clearRelevantMarker() {
        Object.keys(this.resultMarkers).forEach((key) => {
            const { marker } = this.resultMarkers[key];
            marker.setOpacity(0.2);
            marker.setZIndex(90);
            marker.setIcon(null);
        });
    }

    private setZoomLevel(zoomLevel) {
        this.googleMap.setZoom(zoomLevel);
    }

    public centerMapOnPoint(latitude, longitude) {
        this.googleMap.setCenter({ lat: latitude + 0.010, lng: longitude });
    }

    public focusOnMarker(markerId: string) {
        Object.keys(this.resultMarkers)
        .filter(key => this.resultMarkers[key]['markerid'] == markerId)
        .forEach((key) => {
            const { marker } = this.resultMarkers[key];
            // this.setZoomLevel(14);
            const { lat, lng } = marker.getPosition();
            this.centerMapOnPoint(lat(), lng());
            google.maps.event.trigger(marker, 'click');
            marker.setAnimation(google.maps.Animation.DROP);
            const customEventCause = {name: 'resultClick', type: 'customEventType'};
            const metaData = {key1: 'value1', key2: 'value2'};
            Coveo.logClickEvent(document.body, customEventCause, metaData, null);
        });
        document.getElementById('CoveoMap').scrollIntoView();
    }
}

Initialization.registerAutoCreateComponent(CoveoMap);
