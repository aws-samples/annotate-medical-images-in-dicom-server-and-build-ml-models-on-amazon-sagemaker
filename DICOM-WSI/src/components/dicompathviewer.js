import react from "react";
import "./styles/main.css";
import "./styles/react-checkbox-tree.css";
import CheckboxTree from 'react-checkbox-tree';

/******************************************************
 * DICOM dependencies
 ******************************************************/

var DICOMwebClient = require("dicomweb-client");
var DICOMMicroscopyViewer = require("dicom-microscopy-viewer");
var dcmjs = require("dcmjs");

/******************************************************
 * INPUT VARIABLES - DATA FROM GROUNDTRUTH TEMPLATE
 ******************************************************/
const STUDY_ID =  document.querySelector('#studyid').innerText.trim();
const SERIES_ID = document.querySelector('#seriesid').innerText.trim();
const LABELS = document.querySelector('#labels').innerText.trim();

function init() {
  console.log(" initializing client");

  /******************************************************
   *  WORKING - PUB SERVER
   ******************************************************/
  const url = "https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs";
  const client = new DICOMwebClient.api.DICOMwebClient({ url });

  const studyInstanceUID = STUDY_ID;
  const seriesInstanceUID = SERIES_ID;

  const searchInstanceOptions = {
    studyInstanceUID,
    seriesInstanceUID,
  };

  /******************************************************
   *  Searching for instances
   ******************************************************/

  client
    .searchForInstances(searchInstanceOptions)
    .then((instances) => {
      const promises = [];
      for (let i = 0; i < instances.length; i++) {
        const seriesInstanceUID = instances[i]["0020000E"]["Value"][0];
        const sopInstanceUID = instances[i]["00080018"]["Value"][0];
        const retrieveInstanceOptions = {
          studyInstanceUID,
          seriesInstanceUID,
          sopInstanceUID,
        };

        const promise = client
          .retrieveInstanceMetadata(retrieveInstanceOptions)
          .then((metadata) => {
            const image = DICOMMicroscopyViewer.metadata.formatMetadata(
              metadata[0]
            );
            if (image.ImageType[2] === "VOLUME") {
              return metadata[0];
            }
          });

        promises.push(promise);
      }

      return Promise.all(promises);
    })
    .then((metadata) => {
      let controls = ["fullscreen","zoom","overview"]
      const viewer =
        new DICOMMicroscopyViewer.api.VLWholeSlideMicroscopyImageViewer({
          client,
          metadata,
          controls,
          retrieveRendered: true,
        });

      const container = document.getElementById("dicomImage");
      viewer.render({ container });

      viewer.activateDrawInteraction({ geometryType: "polygon" });
      viewer.activateSelectInteraction();
      window.viewer = viewer;
    });
}

function disableToolList() {
  const toolList = document
    .getElementById("tools-list")
    .querySelector("li.active");
  if (toolList !== null) {
    toolList.classList.remove("active");
  }
}

class DicomPathViewer extends react.Component {
  constructor(props) {
    super(props);

    this.onCheck = this.onCheck.bind(this);
    this.onExpand = this.onExpand.bind(this);

    this.state = {
       dataset: '',
       selectedDiseases: []
    };
  }

  state = {
      checked: [
      ],
      expanded: [
      ],
  };


  onCheck(checked, node) {
    console.log(node);
      this.setState({ checked });

      var checked = checked;
      var selectedDiseases = [...this.state.selectedDiseases];
      var index = this.state.selectedDiseases.indexOf(node.label)

      if(checked && index === -1) {
          selectedDiseases.push(node.label)
      } else {
        selectedDiseases.splice(index,1)
      }
      console.log(selectedDiseases)

      this.setState({
        selectedDiseases: selectedDiseases
      })
  }

  onExpand(expanded) {
      this.setState({ expanded });
  }

  componentDidMount() {
    console.log("calling init");
    init();
    this.registerToolClickEventListener();
    this.registerGenerateAnnotationEventListener();
  }

  registerToolClickEventListener() {
    document.getElementById("tools-list").addEventListener("click", (event) => {
      const geometryType = event.target.id;
      disableToolList();
      window.viewer.activateDrawInteraction({ geometryType });
      document
        .getElementById(`${geometryType}`)
        .parentNode.setAttribute("class", "active");
    });
  }

  registerGenerateAnnotationEventListener() {
    document
      .getElementById("generateAnnotation")
      .addEventListener("click", (event) => {
        const rois = window.viewer.getAllROIs();
        if (rois.length === 0) {
          console.log("Please, draw an region of interest first before submitting.");
        }
  
        // Metadata of image at highest resolution level
        const imageMetadata =
          window.viewer.imageMetadata[window.viewer.imageMetadata.length - 1];
        const observationContext = new dcmjs.sr.templates.ObservationContext({
          observerPersonContext: new dcmjs.sr.templates.ObserverContext({
            observerType: new dcmjs.sr.coding.CodedConcept({
              value: "121006",
              schemeDesignator: "DCM",
              meaning: "Person",
            }),
            observerIdentifyingAttributes:
              new dcmjs.sr.templates.PersonObserverIdentifyingAttributes({
                name: "Robo^Doc",
              }),
          }),
          observerDeviceContext: new dcmjs.sr.templates.ObserverContext({
            observerType: new dcmjs.sr.coding.CodedConcept({
              value: "121007",
              schemeDesignator: "DCM",
              meaning: "Device",
            }),
            observerIdentifyingAttributes:
              new dcmjs.sr.templates.DeviceObserverIdentifyingAttributes({
                uid: dcmjs.data.DicomMetaDictionary.uid(), // FIXME
              }),
          }),
          subjectContext: new dcmjs.sr.templates.SubjectContext({
            subjectClass: new dcmjs.sr.coding.CodedConcept({
              value: "121027",
              schemeDesignator: "DCM",
              meaning: "Specimen",
            }),
            subjectClassSpecificContext:
              new dcmjs.sr.templates.SubjectContextSpecimen({
                uid: imageMetadata.SpecimenDescriptionSequence[0].SpecimenUID,
                identifier:
                  imageMetadata.SpecimenDescriptionSequence[0].SpecimenIdentifier,
                containerIdentifier: imageMetadata.ContainerIdentifier,
              }),
          }),
        });
  
        const imagingMeasurements = [];
        for (let i = 0; i < rois.length; i++) {
          console.log("Looping through ROI " + i);
          const roi = rois[i];
          const group =
            new dcmjs.sr.templates.PlanarROIMeasurementsAndQualitativeEvaluations(
              {
                trackingIdentifier: new dcmjs.sr.templates.TrackingIdentifier({
                  uid: roi.uid,
                  identifier: `Measurements of ROI #${i + 1}`,
                }),
                referencedRegion: new dcmjs.sr.contentItems.ImageRegion3D({
                  graphicType: roi.scoord3d.graphicType,
                  graphicData: roi.scoord3d.graphicData,
                  frameOfReferenceUID: roi.scoord3d.frameOfReferenceUID,
                }),
                findingType: new dcmjs.sr.coding.CodedConcept({
                  value: "108369006",
                  schemeDesignator: "SCT",
                  meaning: "Tumor",
                }),
              }
            );
          imagingMeasurements.push(...group);
        }
  
        const measurementReport = new dcmjs.sr.templates.MeasurementReport({
          languageOfContentItemAndDescendants:
            new dcmjs.sr.templates.LanguageOfContentItemAndDescendants({}),
          observationContext: observationContext,
          procedureReported: new dcmjs.sr.coding.CodedConcept({
            value: "112703",
            schemeDesignator: "DCM",
            meaning: "Whole Slide Imaging",
          }),
          imagingMeasurements: imagingMeasurements,
        });
  
        const dataset = new dcmjs.sr.documents.Comprehensive3DSR({
          content: measurementReport[0],
          evidence: [imageMetadata],
          seriesInstanceUID: dcmjs.data.DicomMetaDictionary.uid(),
          seriesNumber: 1,
          seriesDescription: "Whole slide imaging structured report example",
          sopInstanceUID: dcmjs.data.DicomMetaDictionary.uid(),
          instanceNumber: 1,
          manufacturer: "dcmjs-org",
        });
  
        const fileMetaInformationVersionArray = new Uint8Array(2);
        fileMetaInformationVersionArray[1] = 1;
        dataset._meta = {
          FileMetaInformationVersion: {
            Value: [fileMetaInformationVersionArray.buffer], // TODO
            vr: "OB",
          },
          MediaStorageSOPClassUID: dataset.sopClassUID,
          MediaStorageSOPInstanceUID: dataset.sopInstanceUID,
          TransferSyntaxUID: {
            Value: ["1.2.840.10008.1.2.1"],
            vr: "UI",
          },
          ImplementationClassUID: {
            Value: [dcmjs.data.DicomMetaDictionary.uid()],
            vr: "UI",
          },
          ImplementationVersionName: {
            Value: ["dicom-microscopy-viewer-example"],
            vr: "SH",
          },
        };
        console.log("========= Printing dataset ==========");
        this.setState({ dataset: dataset });
        console.log(this.state)
        console.log("========= Finished Printing dataset ==========");
        const blob = dcmjs.data.datasetToBlob(dataset);
      });
  }


  render() {
    const { checked, expanded } = this.state;
    
    return (
      <div id="main">
        <div class="container">
          <div class="page-header">
            <h1>Slide Microscopy Image Annotation</h1>
          </div>
          <div class="bs-example" data-example-id="simple-thumbnails">
            <div class="row">
              <div class="col-xs-12 col-md-9" >
                  <ul class="nav nav-pills" id="tools-list">
                    <li role="presentation" class="active">
                      <a id="polygon">Polygon</a>
                    </li>
                    <li role="presentation">
                      <a id="point">Point</a>
                    </li>
                    <li role="presentation">
                      <a id="circle">Circle</a>
                    </li>
                    <li role="presentation">
                      <a id="box">Box</a>
                    </li>
                    <li role="presentation">
                      <a id="freehandpolygon">Freehand Polygon</a>
                    </li>
                    <li role="presentation">
                      <a id="line">Line</a>
                    </li>
                    <li role="presentation">
                      <a id="freehandline">Freehand Line</a>
                    </li>
                  </ul>
                  <br />
              </div>
              <div class="col-xs-12 col-md-3">
                <div class="list-group">
                  <input
                    type="button"
                    class="btn btn-primary center-block invisible"
                    id="generateAnnotation"
                    value="Generate Annotation"
                    name="Generate Annotation"
                  />
                </div>
              </div>
            </div>

            <div class="row">
              <div class="col-xs-12 col-md-9">
                <div class="image-container">
                  <div class="image-container-body">
                    <div id="dicomImage" class="viewport"></div>
                  </div>

                </div>
              </div>
              <div class="col-xs-12 col-md-3">
              <div className="expand-all-container">
                <CheckboxTree
                    checked={checked}
                    expanded={expanded}
                    iconsClass="fa5"
                    nodes={JSON.parse(LABELS)}
                    showExpandAll={true}
                    onCheck={this.onCheck}
                    onExpand={this.onExpand}
                    showNodeIcon={false}
                    noCascade
                />
            </div>
              </div>
               
            </div>
          </div>
        </div>
        <pre hidden>{JSON.stringify(this.state, null, 2)}</pre>
      </div>
    );
  }
}

export default DicomPathViewer;
