
/*-- |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/|

    KinEval | Kinematic Evaluator | RRT motion planning

    Implementation of robot kinematics, control, decision making, and dynamics 
        in HTML5/JavaScript and threejs
     
    @author ohseejay / https://github.com/ohseejay / https://bitbucket.org/ohseejay

    Chad Jenkins
    Laboratory for Perception RObotics and Grounded REasoning Systems
    University of Michigan

    License: Creative Commons 3.0 BY-SA

|\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| |\/| --*/

//////////////////////////////////////////////////
/////     RRT MOTION PLANNER
//////////////////////////////////////////////////

// STUDENT: 
// compute motion plan and output into robot_path array 
// elements of robot_path are vertices based on tree structure in tree_init() 
// motion planner assumes collision checking by kineval.poseIsCollision()

/* KE 2 : Notes:
   - Distance computation needs to consider modulo for joint angles
   - robot_path[] should be used as desireds for controls
   - Add visualization of configuration for current sample
   - Add cubic spline interpolation
   - Add hook for random configuration
   - Display planning iteration number in UI
*/

/*
STUDENT: reference code has functions for:

*/

kineval.planMotionRRTConnect = function motionPlanningRRTConnect() {

    // exit function if RRT is not implemented
    //   start by uncommenting kineval.robotRRTPlannerInit 
    if (typeof kineval.robotRRTPlannerInit === 'undefined') return;

    if ((kineval.params.update_motion_plan) && (!kineval.params.generating_motion_plan)) {
        kineval.robotRRTPlannerInit();
        kineval.params.generating_motion_plan = true;
        kineval.params.update_motion_plan = false;
        kineval.params.planner_state = "initializing";
    }
    if (kineval.params.generating_motion_plan) {
        rrt_result = robot_rrt_planner_iterate();
        if (rrt_result === "reached") {
            kineval.params.update_motion_plan = false; // KE T needed due to slight timing issue
            kineval.params.generating_motion_plan = false;
            textbar.innerHTML = "planner execution complete";
            kineval.params.planner_state = "complete";
        }
        else kineval.params.planner_state = "searching";
    }
    else if (kineval.params.update_motion_plan_traversal||kineval.params.persist_motion_plan_traversal) {

        if (kineval.params.persist_motion_plan_traversal) {
            kineval.motion_plan_traversal_index = (kineval.motion_plan_traversal_index+1)%kineval.motion_plan.length;
            textbar.innerHTML = "traversing planned motion trajectory";
        }
        else
            kineval.params.update_motion_plan_traversal = false;

        // set robot pose from entry in planned robot path
        robot.origin.xyz = [
            kineval.motion_plan[kineval.motion_plan_traversal_index].vertex[0],
            kineval.motion_plan[kineval.motion_plan_traversal_index].vertex[1],
            kineval.motion_plan[kineval.motion_plan_traversal_index].vertex[2]
        ];

        robot.origin.rpy = [
            kineval.motion_plan[kineval.motion_plan_traversal_index].vertex[3],
            kineval.motion_plan[kineval.motion_plan_traversal_index].vertex[4],
            kineval.motion_plan[kineval.motion_plan_traversal_index].vertex[5]
        ];

        // KE 2 : need to move q_names into a global parameter
        for (x in robot.joints) {
            robot.joints[x].angle = kineval.motion_plan[kineval.motion_plan_traversal_index].vertex[q_names[x]];
        }

    }
}


    // STENCIL: uncomment and complete initialization function
kineval.robotRRTPlannerInit = function robot_rrt_planner_init() {

    // form configuration from base location and joint angles
    q_start_config = [
        robot.origin.xyz[0],
        robot.origin.xyz[1],
        robot.origin.xyz[2],
        robot.origin.rpy[0],
        robot.origin.rpy[1],
        robot.origin.rpy[2]
    ];

    q_names = {};  // store mapping between joint names and q DOFs
    q_index = [];  // store mapping between joint names and q DOFs

    for (x in robot.joints) {
        q_names[x] = q_start_config.length;
        q_index[q_start_config.length] = x;
        q_start_config = q_start_config.concat(robot.joints[x].angle);
    }

    // set goal configuration as the zero configuration
    var i; 
    q_goal_config = new Array(q_start_config.length);
    for (i=0;i<q_goal_config.length;i++) q_goal_config[i] = 0;

    // flag to continue rrt iterations
    rrt_iterate = true;
    rrt_iter_count = 0;

    // make sure the rrt iterations are not running faster than animation update
    cur_time = Date.now();

    eps_p = 0.3;
    eps_a = 0.15;

    T_a = tree_init(q_start_config);
    T_b = tree_init(q_goal_config);

    path = [];
}



function robot_rrt_planner_iterate() {

    var i;
    rrt_alg = 1;  // 0: basic rrt (OPTIONAL), 1: rrt_connect (REQUIRED)

    if (rrt_iterate && (Date.now()-cur_time > 10)) {
        cur_time = Date.now();
        if (rrt_alg == 0){
            qrand = random_config(q_goal_config);
            ind = find_nearest_neighbor(T_a, qrand);
            q_new = new_config(T_a.vertices[ind], qrand);

            if (!kineval.poseIsCollision(q_new)){
                tree_add_vertex(T_a, q_new);
                tree_add_edge(T_a, T_a.newest, ind);
            }

            if (finish_search(q_new, q_goal_config)){
                rrt_iterate = false;
                kineval.motion_plan = [];
                q_now = T_a.vertices[T_a.newest];
                var flag = 0;
                while (!finish_search(q_now.vertex, q_start_config)){
                    q_now = q_now.vertex.parent;
                    path[flag] = q_now;
                    kineval.motion_plan.unshift(path[flag]);
                    flag += 1;
                }
                
                for (var i=0; i<path.length-1; i++){
                    path[i].vertex.parent.geom.material.color = {r:1,g:0,b:0};
                }
                T_a.vertices[T_a.newest].geom.material.color = {r:1,g:0,b:0};

                return "reached";
            }

        }

        if (rrt_alg == 1){
            qrand = random_config(q_goal_config);
            ind = find_nearest_neighbor(T_a, qrand);
            q_new = new_config(T_a.vertices[ind], qrand);
            if (!kineval.poseIsCollision(q_new)&&T_b.vertices.length>=T_a.vertices.length){
                tree_add_vertex(T_a, q_new);
                tree_add_edge(T_a, T_a.newest, ind);
                ind1 = find_nearest_neighbor(T_b, q_new);
                q_new1 = new_config(T_b.vertices[ind1], q_new);
                if (!kineval.poseIsCollision(q_new1)){
                    tree_add_vertex(T_b, q_new1);
                    tree_add_edge(T_b, T_b.newest, ind1);
                    if (!finish_search(q_new1, q_new)){
                        q_new2 = new_config(T_b.vertices[T_b.newest], q_new);
                        if (!kineval.poseIsCollision(q_new2)){
                            tree_add_vertex(T_b,q_new2);
                            tree_add_edge(T_b,T_b.newest,ind1);
                            q_new1 = q_new2;
                        }
                    }
                    else if (finish_search(q_new1, q_new)){
                        rrt_iterate = false;
                        kineval.motion_plan = [];
                        q_now = T_a.vertices[T_a.newest];
                        kineval.motion_plan.unshift(q_now);
                        while (!finish_search(q_now.vertex, q_start_config)){
                            q_now = q_now.vertex.parent;
                            kineval.motion_plan.unshift(q_now);
                            flag += 1;
                        }
                        kineval.motion_plan.unshift(T_a.vertices[0]);
                        q_now = T_b.vertices[T_b.newest];
                        kineval.motion_plan.push(q_now);
                        while (!finish_search(q_now.vertex, q_goal_config)){
                            q_now = q_now.vertex.parent;
                            kineval.motion_plan.push(q_now);
                        }
                        kineval.motion_plan.push(T_b.vertices[0]);
                        for (var i=0; i<kineval.motion_plan.length; i++){
                            kineval.motion_plan[i].geom.material.color = {r:1,g:0,b:0};
                        }
                        return "reached";
                    }
                }
            }
            else if(T_b.vertices.length<T_a.vertices.length){
                qrand = random_config(q_start_config);
                ind = find_nearest_neighbor(T_b, qrand);
                q_new = new_config(T_b.vertices[ind], qrand);
                if (!kineval.poseIsCollision(q_new)){
                    tree_add_vertex(T_b, q_new);
                    tree_add_edge(T_b, T_b.newest, ind);
                    ind1 = find_nearest_neighbor(T_a, q_new);
                    q_new1 = new_config(T_a.vertices[ind1],q_new);
                    if (!kineval.poseIsCollision(q_new1)){
                        tree_add_vertex(T_a, q_new1);
                        tree_add_edge(T_a, T_a.newest, ind1);
                        if (!finish_search(q_new1, q_new)){
                            q_new2 = new_config(T_a.vertices[T_a.newest], q_new);
                            if(!kineval.poseIsCollision(q_new2)){
                                tree_add_vertex(T_a, q_new2);
                                tree_add_edge(T_a, T_a.newest, ind1);
                                q_new1 = q_new2;
                            }
                        }
                        else if(finish_search(q_new1, q_new)){
                            rrt_iterate = false;
                            kineval.motion_plan = [];
                            q_now = T_a.vertices[T_a.newest];
                            kineval.motion_plan.unshift(q_now);
                            while (!finish_search(q_now.vertex, q_start_config)){
                                q_now = q_now.vertex.parent;
                                kineval.motion_plan.unshift(q_now);
                            }
                            kineval.motion_plan.unshift(T_a.vertices[0]);
                            q_now = T_b.vertices[T_b.newest];
                            kineval.motion_plan.push(q_now);
                            while (!finish_search(q_now.vertex, q_goal_config)){
                                q_now = q_now.vertex.parent;
                                kineval.motion_plan.push(q_now);
                            }
                            kineval.motion_plan.push(T_b.vertices[0]);
                            for (var i=0; i<kineval.motion_plan.length; i++){
                                kineval.motion_plan[i].geom.material.color = {r:1,g:0,b:0};
                            }
                            return "reached";
                        }
                    }
                }
            }
        }
    // STENCIL: implement single rrt iteration here. an asynch timing mechanism 
    //   is used instead of a for loop to avoid blocking and non-responsiveness 
    //   in the browser.
    //
    //   once plan is found, highlight vertices of found path by:
    //     tree.vertices[i].vertex[j].geom.material.color = {r:1,g:0,b:0};
    //
    //   provided support functions:
    //
    //   kineval.poseIsCollision - returns if a configuration is in collision
    //   tree_init - creates a tree of configurations
    //   tree_add_vertex - adds and displays new configuration vertex for a tree
    //   tree_add_edge - adds and displays new tree edge between configurations
    }

}

//////////////////////////////////////////////////
/////     STENCIL SUPPORT FUNCTIONS
//////////////////////////////////////////////////

function tree_init(q) {

    // create tree object
    var tree = {};

    // initialize with vertex for given configuration
    tree.vertices = [];
    tree.vertices[0] = {};
    tree.vertices[0].vertex = q;
    tree.vertices[0].edges = [];

    // create rendering geometry for base location of vertex configuration
    add_config_origin_indicator_geom(tree.vertices[0]);

    // maintain index of newest vertex added to tree
    tree.newest = 0;

    return tree;
}

function tree_add_vertex(tree,q) {


    // create new vertex object for tree with given configuration and no edges
    var new_vertex = {};
    new_vertex.edges = [];
    new_vertex.vertex = q;

    // create rendering geometry for base location of vertex configuration
    add_config_origin_indicator_geom(new_vertex);

    // maintain index of newest vertex added to tree
    tree.vertices.push(new_vertex);
    tree.newest = tree.vertices.length - 1;
}

function add_config_origin_indicator_geom(vertex) {

    // create a threejs rendering geometry for the base location of a configuration
    // assumes base origin location for configuration is first 3 elements 
    // assumes vertex is from tree and includes vertex field with configuration

    temp_geom = new THREE.CubeGeometry(0.1,0.1,0.1);
    temp_material = new THREE.MeshLambertMaterial( { color: 0xffff00, transparent: true, opacity: 0.7 } );
    temp_mesh = new THREE.Mesh(temp_geom, temp_material);
    temp_mesh.position.x = vertex.vertex[0];
    temp_mesh.position.y = vertex.vertex[1];
    temp_mesh.position.z = vertex.vertex[2];
    scene.add(temp_mesh);
    vertex.geom = temp_mesh;
}


function tree_add_edge(tree,q1_idx,q2_idx) {

    // add edge to first vertex as pointer to second vertex
    tree.vertices[q1_idx].edges.push(tree.vertices[q2_idx]);

    // add edge to second vertex as pointer to first vertex
    tree.vertices[q2_idx].edges.push(tree.vertices[q1_idx]);

    // can draw edge here, but not doing so to save rendering computation
}

//////////////////////////////////////////////////
/////     RRT IMPLEMENTATION FUNCTIONS
//////////////////////////////////////////////////
function random_config(a){
    var xval = Math.abs(robot_boundary[0][0]-robot_boundary[1][0]);
    var zval = Math.abs(robot_boundary[0][2]-robot_boundary[1][2]);
    var q=[];
    q[0] = Math.random()*(xval+1) + robot_boundary[0][0];
    q[1] = 0;
    q[2] = Math.random()*(zval+1) + robot_boundary[0][2];
    for (var i=3; i<q_start_config.length; i++){
        q[i] = Math.random()*2*Math.PI;
    } 
    q[3] = 0;
    q[5] = 0;
    var p = Math.random();
    if (p <= 0.15){
        for (var i=0;i<q_start_config.length;i++){
            q[i] = a[i];
        }
    }
    //make the robot can only rotate along y"up".
    return q;
}

function find_nearest_neighbor(tree, q){
    var idx;
    var max_dis = Infinity;
    for (var i=0; i<tree.vertices.length; i++){
        var a = tree.vertices[i].vertex[0];
        var b = tree.vertices[i].vertex[2];
        var dis = Math.pow(Math.pow(q[0]-a,2)+Math.pow(q[2]-b,2),0.5);
        for (var j=4; j<tree.vertices[i].length;j++){
            dis += q[j]-tree.vertices[i].vertex[j];
        }
        if (dis <= max_dis){
            max_dis = dis;
            idx = i;
        }
    }
    return idx;
}

function new_config(qnear, qrand){
    var delta_x = [];
    delta_x[0] = qrand[0] - qnear.vertex[0];
    delta_x[1] = 0;
    delta_x[2] = qrand[2] - qnear.vertex[2]; 
    var theta = Math.atan2(delta_x[2],delta_x[0]);
    var q_new = [];
    q_new[0] = qnear.vertex[0] + eps_p*Math.cos(theta);
    q_new[1] = 0;
    q_new[2] = qnear.vertex[2] + eps_p*Math.sin(theta);
    q_new[3] = 0;
    q_new[4] = qnear.vertex[4] + eps_a*(qrand[4] - qnear.vertex[4]);
    q_new[5] = 0;
    for (var i=6; i<qrand.length; i++){
        q_new[i] = qnear.vertex[i] + eps_a*(qrand[i] - qnear.vertex[i]);
    }
    q_new.parent = qnear;
    return q_new;
}

function finish_search(A, B){
    //test q_new and q_goal;
    var a = A[0] - B[0];
    var b = A[2] - B[2];
    if (Math.sqrt(Math.pow(a,2)+Math.pow(b,2))>eps_p) {
        return false;
    }
    for (i=4; i < q_start_config.length; i++){
        if(i==5) {continue};
        if(Math.abs(b[i]-a[i])>eps_a){
            return false;
        }
    }
    return true;
}

function rrt_extend(T, q){
    var ind = find_nearest_neighbor(T, q);
    q_new = new_config(T.vertices[ind],q);

    if(!kineval.poseIsCollision(q_new)){
        tree_add_vertex(T, q_new);
        tree_add_edge(T, T.newest, ind);

        return "advanced";
    }
    return "trapped";
}

    // STENCIL: implement RRT-Connect functions here, such as:
    //   rrt_extend
    //   rrt_connect
    //   random_config
    //   new_config
    //   nearest_neighbor
    //   normalize_joint_state
    //   find_path
    //   path_dfs










