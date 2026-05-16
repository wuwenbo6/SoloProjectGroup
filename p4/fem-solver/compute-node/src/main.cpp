#include <iostream>
#include <vector>
#include <map>
#include <string>
#include <sstream>
#include <nlohmann/json.hpp>
#include <httplib.h>
#include "solver.cpp"

using namespace std;
using json = nlohmann::json;

map<int, vector<double>> parse_nodes(const json& nodes_json) {
    map<int, vector<double>> nodes;
    for (const auto& item : nodes_json.items()) {
        int node_id = stoi(item.key());
        vector<double> coords = item.value().get<vector<double>>();
        nodes[node_id] = coords;
    }
    return nodes;
}

map<int, map<string, any>> parse_elements(const json& elements_json) {
    map<int, map<string, any>> elements;
    for (const auto& item : elements_json.items()) {
        int elem_id = stoi(item.key());
        const auto& elem_data = item.value();
        
        map<string, any> elem;
        elem["type"] = elem_data["type"].get<string>();
        elem["nodes"] = elem_data["nodes"].get<vector<int>>();
        elements[elem_id] = elem;
    }
    return elements;
}

map<string, map<string, double>> parse_materials(const json& materials_json) {
    map<string, map<string, double>> materials;
    for (const auto& item : materials_json.items()) {
        string mat_name = item.key();
        map<string, double> props;
        for (const auto& prop : item.value().items()) {
            props[prop.key()] = prop.value().get<double>();
        }
        materials[mat_name] = props;
    }
    return materials;
}

vector<map<string, any>> parse_boundary_conditions(const json& bc_json) {
    vector<map<string, any>> bcs;
    for (const auto& item : bc_json) {
        map<string, any> bc;
        bc["node"] = item["node"].get<int>();
        bc["dof"] = item["dof"].get<int>();
        bc["value"] = item.value("value", 0.0);
        bcs.push_back(bc);
    }
    return bcs;
}

vector<map<string, any>> parse_loads(const json& loads_json) {
    vector<map<string, any>> loads;
    for (const auto& item : loads_json) {
        map<string, any> load;
        load["node"] = item["node"].get<int>();
        load["dof"] = item["dof"].get<int>();
        load["value"] = item["value"].get<double>();
        loads.push_back(load);
    }
    return loads;
}

int main(int argc, char* argv[]) {
    int port = 8001;
    if (argc > 1) {
        port = stoi(argv[1]);
    }

    MatrixOps::initCuda();

    httplib::Server svr;

    svr.Post("/solve", [](const httplib::Request& req, httplib::Response& res) {
        try {
            json body = json::parse(req.body);
            json subdomain = body["subdomain"];
            
            cout << "Received subdomain: " << subdomain["subdomain_id"] << endl;

            auto nodes = parse_nodes(subdomain["nodes"]);
            auto elements = parse_elements(subdomain["elements"]);
            auto materials = parse_materials(subdomain["materials"]);
            auto bcs = parse_boundary_conditions(subdomain["boundary_conditions"]);
            auto loads = parse_loads(subdomain["loads"]);

            cout << "Nodes: " << nodes.size() << ", Elements: " << elements.size() << endl;

            FEMSolver solver(nodes, elements, materials, bcs, loads);
            solver.solve();
            
            auto displacements = solver.get_displacements();

            json result;
            result["subdomain_id"] = subdomain["subdomain_id"];
            result["displacements"] = json::object();
            for (const auto& entry : displacements) {
                result["displacements"][to_string(entry.first)] = entry.second;
            }

            res.set_content(result.dump(), "application/json");
            cout << "Solved successfully" << endl;

        } catch (const exception& e) {
            cerr << "Error: " << e.what() << endl;
            res.status = 500;
            res.set_content(json({{"error", e.what()}}).dump(), "application/json");
        }
    });

    svr.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(json({{"status", "ok"}}).dump(), "application/json");
    });

    cout << "FEM Compute Node starting on port " << port << endl;
    cout << "Endpoints:" << endl;
    cout << "  POST /solve - Solve FEM subdomain" << endl;
    cout << "  GET  /health - Health check" << endl;
    
    svr.listen("0.0.0.0", port);

    return 0;
}
